import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get user ID from request body
    const { user_id } = await req.json();

    if (!user_id) {
      return jsonResponse({ error: 'user_id is required' }, 400);
    }

    // Verify the request is from the authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Authorization header is required' }, 401);
    }

    // Create a client with the user's token to verify they're deleting their own account
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user: requestingUser }, error: userError } = await supabaseUser.auth.getUser();
    
    if (userError || !requestingUser) {
      return jsonResponse({ error: 'Invalid authentication token' }, 401);
    }

    // Ensure user can only delete their own account
    if (requestingUser.id !== user_id) {
      return jsonResponse({ error: 'You can only delete your own account' }, 403);
    }

    // 유저 데이터 전체 삭제 (FK 의존 순서대로)
    // 1. bookmarks (bookmark_folders 참조)
    const { error: bookmarksError } = await supabaseAdmin
      .from('bookmarks')
      .delete()
      .eq('user_id', user_id);
    if (bookmarksError) {
      console.error('Error deleting bookmarks:', bookmarksError);
      return jsonResponse({ error: 'Failed to delete user data: bookmarks' }, 500);
    }

    // 2. bookmark_folders
    const { error: foldersError } = await supabaseAdmin
      .from('bookmark_folders')
      .delete()
      .eq('user_id', user_id);
    if (foldersError) {
      console.error('Error deleting bookmark folders:', foldersError);
      return jsonResponse({ error: 'Failed to delete user data: bookmark_folders' }, 500);
    }

    // 3. user_progress
    const { error: progressError } = await supabaseAdmin
      .from('user_progress')
      .delete()
      .eq('user_id', user_id);
    if (progressError) {
      console.error('Error deleting user progress:', progressError);
      return jsonResponse({ error: 'Failed to delete user data: user_progress' }, 500);
    }

    // 4. user_settings
    const { error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .delete()
      .eq('user_id', user_id);
    if (settingsError) {
      console.error('Error deleting user settings:', settingsError);
      return jsonResponse({ error: 'Failed to delete user data: user_settings' }, 500);
    }

    // 5. user_profiles
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('id', user_id);
    if (profileError) {
      console.error('Error deleting user profile:', profileError);
      return jsonResponse({ error: 'Failed to delete user data: user_profiles' }, 500);
    }

    // 6. auth 사용자 삭제
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (deleteUserError) {
      console.error('Error deleting auth user:', deleteUserError);
      return jsonResponse({ 
        error: 'Failed to delete user account',
        details: deleteUserError.message 
      }, 500);
    }

    return jsonResponse({ 
      success: true, 
      message: 'User account deleted successfully' 
    });

  } catch (error) {
    console.error('Delete user error:', error);
    return jsonResponse({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});
