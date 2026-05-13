import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => {
  return {
    findWeeklyQuizByWeekNum: vi.fn(),
    saveWeeklyQuiz: vi.fn(),
  };
});

vi.mock("./quiz.repository", () => ({
  findWeeklyQuizByWeekNum: repositoryMocks.findWeeklyQuizByWeekNum,
  saveWeeklyQuiz: repositoryMocks.saveWeeklyQuiz,
}));

const loadService = async (apiKey: string | undefined) => {
  vi.resetModules();
  if (apiKey) {
    process.env.OPENAI_API_KEY = apiKey;
  } else {
    delete process.env.OPENAI_API_KEY;
  }
  return import("./quiz.service");
};

describe("generateWeeklyQuiz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("이미 존재하는 주차는 409 에러를 던진다", async () => {
    const { generateWeeklyQuiz } = await loadService("test-key");
    repositoryMocks.findWeeklyQuizByWeekNum.mockResolvedValue({ id: "quiz-1" });

    const run = generateWeeklyQuiz({ weekNum: 2026032 });

    await expect(run).rejects.toMatchObject({
      status: 409,
      alreadyExists: true,
    });
    expect(repositoryMocks.saveWeeklyQuiz).not.toHaveBeenCalled();
  });

  it("OpenAI 응답을 파싱하고 저장한 뒤 생성 결과를 반환한다", async () => {
    const { generateWeeklyQuiz } = await loadService("test-key");
    repositoryMocks.findWeeklyQuizByWeekNum.mockResolvedValue(null);
    repositoryMocks.saveWeeklyQuiz.mockResolvedValue({ createdAt: "2026-03-27T00:00:00.000Z" });

    const openAiPayload = {
      questions: [
        {
          question: "The manager requested an updated _____ by noon.",
          choices: ["itinerary", "investment", "appointment", "procedure"],
          answer: "itinerary",
          explanation: "문맥상 일정표를 의미하는 itinerary가 가장 자연스럽습니다.",
        },
        {
          question: "Please submit all travel receipts for _____ by Friday.",
          choices: ["reimbursement", "discount", "attendance", "assembly"],
          answer: "reimbursement",
          explanation: "비용 정산 문맥이므로 reimbursement가 정답입니다.",
        },
      ],
    };

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(openAiPayload) } }],
      }),
    } as Response);

    const result = await generateWeeklyQuiz({ year: 2026, month: 3, week: 2 });

    expect(repositoryMocks.findWeeklyQuizByWeekNum).toHaveBeenCalledWith(2026032);
    expect(repositoryMocks.saveWeeklyQuiz).toHaveBeenCalledTimes(1);

    const [savedWeekNum, savedQuestions] = repositoryMocks.saveWeeklyQuiz.mock.calls[0];
    expect(savedWeekNum).toBe(2026032);
    expect(savedQuestions).toHaveLength(2);
    expect(savedQuestions[0].choices).toHaveLength(4);
    expect(savedQuestions[0].choices).toEqual(expect.arrayContaining(openAiPayload.questions[0].choices));
    expect(savedQuestions[0].answer).toBe("itinerary");

    expect(result).toEqual({
      questions: savedQuestions,
      created_at: "2026-03-27T00:00:00.000Z",
    });
  });

  it("OpenAI 응답이 JSON이 아니면 파싱 에러를 던진다", async () => {
    const { generateWeeklyQuiz } = await loadService("test-key");
    repositoryMocks.findWeeklyQuizByWeekNum.mockResolvedValue(null);

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "not-a-json" } }],
      }),
    } as Response);

    await expect(generateWeeklyQuiz({ weekNum: 2026032 })).rejects.toThrow(
      "Failed to parse JSON response",
    );
    expect(repositoryMocks.saveWeeklyQuiz).not.toHaveBeenCalled();
  });

  it("OPENAI_API_KEY가 없으면 호출 전에 에러를 던진다", async () => {
    const { generateWeeklyQuiz } = await loadService(undefined);
    repositoryMocks.findWeeklyQuizByWeekNum.mockResolvedValue(null);

    await expect(generateWeeklyQuiz({ weekNum: 2026032 })).rejects.toThrow(
      "OPENAI_API_KEY is not configured",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
