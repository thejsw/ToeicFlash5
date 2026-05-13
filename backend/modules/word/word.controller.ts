// word.controller.ts
import { Request, Response } from "express";
import { fetchWords } from "./word.service";

export const getWords = async (req: Request, res: Response) => {
  const day = Number(req.params.day);
  const words = await fetchWords(day);
  res.json(words);
};