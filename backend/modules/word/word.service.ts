// word.service.ts
import { getWordsByDay } from "./word.repository";

export const fetchWords = async (day: number) => {
  return await getWordsByDay(day);
};