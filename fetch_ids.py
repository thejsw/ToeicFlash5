import supabase
from supabase import create_client

url = "https://fruuhjybiniukkixfdof.supabase.co"
key = "sb_publishable_8zzxryE6eT86OwWzBwAWFw_iLFbp0Y2"
client = create_client(url, key)

# words 테이블에서 id만 가져오기
response = client.table("words").select("id").order("day").order("order_index").execute()
ids = [item["id"] for item in response.data]

# TXT 파일로 저장
with open("words_ids.txt", "w") as f:
    for word_id in ids:
        f.write(word_id + "\n")

print(f"{len(ids)}개의 id가 words_ids.txt에 저장되었습니다.")