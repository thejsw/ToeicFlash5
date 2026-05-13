import express from "express";
import { getWords } from "./modules/word/word.controller";
import { postGenerateWeeklyQuiz } from "./modules/quiz/quiz.controller";

const app = express();
app.use(express.json());

app.get("/words/:day", getWords);
app.post("/quiz/generate", postGenerateWeeklyQuiz);

const PORT = Number(process.env.PORT ?? 3000);

// #region agent log
fetch('http://127.0.0.1:7243/ingest/57760822-afc0-4241-84bd-3d7185be3e6b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'boot-check',hypothesisId:'H2',location:'backend/main.ts:13',message:'backend listen start',data:{port:PORT,pid:process.pid},timestamp:Date.now()})}).catch(()=>{});
// #endregion
const server = app.listen(PORT, () => {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/57760822-afc0-4241-84bd-3d7185be3e6b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'boot-check',hypothesisId:'H2',location:'backend/main.ts:17',message:'backend listen success',data:{port:PORT,pid:process.pid},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
});

server.on("error", (error: NodeJS.ErrnoException) => {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/57760822-afc0-4241-84bd-3d7185be3e6b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'boot-check',hypothesisId:'H3',location:'backend/main.ts:23',message:'backend listen error',data:{code:error?.code??null,message:error?.message??null,port:PORT,pid:process.pid},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
});