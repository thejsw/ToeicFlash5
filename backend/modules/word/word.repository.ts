// word.repository.ts
export const getWordsByDay = async (day: number) => {
    // 지금은 Supabase 그대로 써도 OK
    const { data, error } = await supabase
      .from("words")
      .select("*")
      .eq("day", day);
  
    if (error) throw error;
    return data;
  };