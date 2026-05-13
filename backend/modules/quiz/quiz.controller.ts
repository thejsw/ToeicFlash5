import { Request, Response } from "express";
import { generateWeeklyQuiz } from "./quiz.service";

export const postGenerateWeeklyQuiz = async (req: Request, res: Response) => {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/57760822-afc0-4241-84bd-3d7185be3e6b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'route-check',hypothesisId:'H5',location:'backend/modules/quiz/quiz.controller.ts:7',message:'backend /quiz/generate hit',data:{hasBody:Boolean(req.body),weekNum:req.body?.weekNum??null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const result = await generateWeeklyQuiz(req.body ?? {});
    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status =
      typeof (error as { status?: number })?.status === "number"
        ? (error as { status: number }).status
        : 500;
    const alreadyExists = Boolean((error as { alreadyExists?: boolean })?.alreadyExists);

    res.status(status).json({
      error: message,
      ...(alreadyExists ? { alreadyExists: true } : {}),
    });
  }
};
