export interface QuizQuestion {
  question: string;
  choices: string[];
  answer: string; // 정답 선택지 텍스트
  explanation: string;
}

export interface QuizResult {
  question: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
}


