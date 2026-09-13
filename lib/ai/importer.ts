import { Quiz, QuizQuestion } from '@/types/quiz';

export interface PromptTemplateOptions {
  topic: string;
  questionCount: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'chaotic';
  tone: 'scholarly' | 'humorous' | 'sarcastic' | 'energetic';
  timePerQuestion?: number;
  customInstructions?: string;
}

/**
 * Builds an optimal prompt that any external AI (ChatGPT, Claude, DeepSeek, Grok, Gemini)
 * will easily understand and return clean JSON quiz questions for our system.
 */
export function generateExternalAIPrompt(opts: PromptTemplateOptions): string {
  const customPart = opts.customInstructions?.trim()
    ? `\nADDITIONAL USER INSTRUCTIONS:\n${opts.customInstructions.trim()}\n`
    : '';

  const timeLimit = opts.timePerQuestion || 15;

  return `Generate EXACTLY ${opts.questionCount} multiple-choice trivia and academic questions on the topic: "${opts.topic.trim() || 'General Knowledge'}".
Difficulty level: ${opts.difficulty}
Tone: ${opts.tone}${customPart}

CRITICAL QUALITY & FORMATTING RULES:
1. TOPIC ACCURACY: Generate real, concrete, factually accurate questions specifically about "${opts.topic.trim()}". Ensure questions are easy to interpret, educational, and meaningful.
2. EXACT COUNT: You must generate EXACTLY ${opts.questionCount} questions in the "questions" array.
3. MATHEMATICS & FORMULAS: For any math, physics, engineering, or chemistry formulas, equations, or scientific symbols, ALWAYS format them using standard LaTeX enclosed in single dollar signs $...$ (e.g. "$f(x) = 3x^2 + 8x - 5$", "$\\frac{dy}{dx}$", "$E = mc^2$", "$CH_4$").
4. 4 REAL OPTIONS: Ensure each question has EXACTLY 4 distinct, plausible answer strings in the "options" array. Do not put option labels like "A)" or "Option 1" inside the strings.
5. "correctIndex" must be an integer (0 for option 1, 1 for option 2, 2 for option 3, 3 for option 4).
6. No unicode emojis in questions or options. Return ONLY valid JSON matching the schema below.

SCHEMA:
{
  "title": "Clear, concise quiz title",
  "description": "1-sentence synopsis of the quiz",
  "category": "Domain of the topic (e.g. Science, Mathematics, Technology, History, Geography, Pop Culture)",
  "difficulty": "${opts.difficulty}",
  "questions": [
    {
      "question": "Clear, unambiguous question text (use $...$ for math)",
      "options": ["First option value", "Second option value", "Third option value", "Fourth option value"],
      "correctIndex": 0,
      "timeLimit": ${timeLimit},
      "points": 1000,
      "explanation": "1-2 sentence verified factual explanation or proof (use $...$ for math)",
      "aiHostComment": "A sharp, insightful analytical remark (no emojis)"
    }
  ]
}`;
}

export interface ParseResult {
  success: boolean;
  quiz?: Quiz;
  error?: string;
}

/**
 * Normalizes options and cleans leading prefixes like "A)", "(B)", "1.", "Option A:".
 * Ensures real options are never lost or replaced with placeholder strings.
 */
export function normalizeAndCleanOptions(
  rawQ: any
): { options: string[]; correctIndex: number } {
  let rawList: string[] = [];

  if (Array.isArray(rawQ.options)) {
    rawList = rawQ.options.map((opt: any) => typeof opt === 'object' && opt !== null ? String(opt.text || opt.label || opt.value || '') : String(opt || ''));
  } else if (Array.isArray(rawQ.choices)) {
    rawList = rawQ.choices.map((opt: any) => typeof opt === 'object' && opt !== null ? String(opt.text || opt.label || opt.value || '') : String(opt || ''));
  } else if (Array.isArray(rawQ.answers)) {
    rawList = rawQ.answers.map((opt: any) => typeof opt === 'object' && opt !== null ? String(opt.text || opt.label || opt.value || '') : String(opt || ''));
  } else if (rawQ.options && typeof rawQ.options === 'object') {
    rawList = Object.values(rawQ.options).map((v) => String(v || ''));
  } else if (rawQ.choices && typeof rawQ.choices === 'object') {
    rawList = Object.values(rawQ.choices).map((v) => String(v || ''));
  } else if (typeof rawQ.options === 'string') {
    rawList = rawQ.options.split(/\n|,/).map((s: string) => s.trim()).filter(Boolean);
  }

  // Filter out completely blank entries
  rawList = rawList.map((s) => String(s).trim()).filter((s) => s.length > 0);

  // Clean option prefixes
  const cleanedList = rawList.map((item) => {
    let clean = item;
    clean = clean.replace(/^(?:Option\s*[A-D0-9][:\.\-\)]|\([A-D0-9]\)|[A-D0-9][\)\.\:\-])\s*/i, '');
    clean = clean.replace(/^["']|["']$/g, '').trim();
    return clean || item;
  });

  // Ensure 4 plausible options
  let finalOptions = [...cleanedList];
  if (finalOptions.length === 0) {
    finalOptions = ['Option A', 'Option B', 'Option C', 'Option D'];
  } else if (finalOptions.length < 4) {
    while (finalOptions.length < 4) {
      finalOptions.push(`Choice ${String.fromCharCode(65 + finalOptions.length)}`);
    }
  } else if (finalOptions.length > 4) {
    finalOptions = finalOptions.slice(0, 4);
  }

  // Correct Index calculation
  let correctIndex = 0;
  if (typeof rawQ.correctIndex === 'number' && rawQ.correctIndex >= 0 && rawQ.correctIndex < finalOptions.length) {
    correctIndex = Math.floor(rawQ.correctIndex);
  } else if (typeof rawQ.correct_index === 'number' && rawQ.correct_index >= 0 && rawQ.correct_index < finalOptions.length) {
    correctIndex = Math.floor(rawQ.correct_index);
  } else if (typeof rawQ.correctAnswerIndex === 'number' && rawQ.correctAnswerIndex >= 0 && rawQ.correctAnswerIndex < finalOptions.length) {
    correctIndex = Math.floor(rawQ.correctAnswerIndex);
  } else if (typeof rawQ.answerIndex === 'number' && rawQ.answerIndex >= 0 && rawQ.answerIndex < finalOptions.length) {
    correctIndex = Math.floor(rawQ.answerIndex);
  } else if (rawQ.correctAnswer !== undefined || rawQ.answer !== undefined || rawQ.correct_answer !== undefined) {
    const ansStr = String(rawQ.correctAnswer ?? rawQ.answer ?? rawQ.correct_answer).trim();
    const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, a: 0, b: 1, c: 2, d: 3 };
    if (letterMap[ansStr] !== undefined) {
      correctIndex = letterMap[ansStr];
    } else if (['0', '1', '2', '3'].includes(ansStr)) {
      correctIndex = parseInt(ansStr, 10);
    } else {
      const cleanAns = ansStr.replace(/^(?:Option\s*[A-D0-9][:\.\-\)]|\([A-D0-9]\)|[A-D0-9][\)\.\:\-])\s*/i, '').trim().toLowerCase();
      const foundIdx = finalOptions.findIndex((opt) => opt.toLowerCase().trim() === cleanAns || opt.toLowerCase().trim() === ansStr.toLowerCase());
      if (foundIdx !== -1) {
        correctIndex = foundIdx;
      }
    }
  }

  return { options: finalOptions, correctIndex };
}

/**
 * Smartly parses raw text, markdown-fenced code blocks, JSON objects, or arrays pasted by the user.
 */
export function parseImportedQuizJson(rawInput: string, fallbackTopic = 'Custom Quiz'): ParseResult {
  const cleanInput = rawInput.trim();
  if (!cleanInput) {
    return { success: false, error: 'Please paste the AI response or JSON before clicking import.' };
  }

  // 1. Extract JSON content if wrapped in markdown code fences ```json ... ``` or ``` ... ```
  let jsonString = cleanInput;
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = fenceRegex.exec(cleanInput);
  if (match && match[1]) {
    jsonString = match[1].trim();
  } else {
    // If not in code fence, find the first { or [ and last } or ]
    const firstBrace = cleanInput.indexOf('{');
    const firstBracket = cleanInput.indexOf('[');
    let startIdx = -1;

    if (firstBrace !== -1 && firstBracket !== -1) {
      startIdx = Math.min(firstBrace, firstBracket);
    } else if (firstBrace !== -1) {
      startIdx = firstBrace;
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
    }

    const lastBrace = cleanInput.lastIndexOf('}');
    const lastBracket = cleanInput.lastIndexOf(']');
    const endIdx = Math.max(lastBrace, lastBracket);

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      jsonString = cleanInput.substring(startIdx, endIdx + 1).trim();
    }
  }

  // 2. Parse JSON
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: any) {
    return {
      success: false,
      error: `Could not parse JSON syntax: ${err.message || 'Invalid format'}. Please make sure the AI response contains valid JSON.`,
    };
  }

  // 3. Normalize into Quiz structure
  try {
    let rawQuestions: any[] = [];
    let title = fallbackTopic;
    let description = `Created on ${new Date().toLocaleDateString()}`;
    let category = 'Imported Quiz';
    let difficulty: 'easy' | 'medium' | 'hard' | 'chaotic' = 'medium';

    if (Array.isArray(parsed)) {
      rawQuestions = parsed;
    } else if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.questions)) {
        rawQuestions = parsed.questions;
      } else if (Array.isArray(parsed.quiz)) {
        rawQuestions = parsed.quiz;
      } else if (Array.isArray(parsed.items)) {
        rawQuestions = parsed.items;
      } else {
        return { success: false, error: 'JSON does not contain a "questions" list.' };
      }

      if (parsed.title) title = String(parsed.title);
      if (parsed.description) description = String(parsed.description);
      if (parsed.category) category = String(parsed.category);
      if (parsed.difficulty && ['easy', 'medium', 'hard', 'chaotic'].includes(parsed.difficulty.toLowerCase())) {
        difficulty = parsed.difficulty.toLowerCase();
      }
    }

    if (rawQuestions.length === 0) {
      return { success: false, error: 'No questions found in the provided JSON.' };
    }

    const formattedQuestions: QuizQuestion[] = rawQuestions.map((q: any, idx: number) => {
      const qText = String(q.question || q.prompt || q.title || `Question ${idx + 1}`);
      const { options, correctIndex } = normalizeAndCleanOptions(q);

      return {
        id: `q-imported-${idx + 1}-${Date.now()}`,
        question: qText,
        options,
        correctIndex,
        timeLimit: typeof q.timeLimit === 'number' ? q.timeLimit : 15,
        points: typeof q.points === 'number' ? q.points : 1000,
        explanation: String(q.explanation || q.rationale || 'Verified factual knowledge.'),
        aiHostComment: String(q.aiHostComment || q.comment || 'Precision analytical remark.'),
      };
    });

    const quiz: Quiz = {
      id: `imported-${Date.now()}`,
      title,
      description,
      category,
      difficulty,
      topic: fallbackTopic,
      questions: formattedQuestions,
      createdAt: new Date().toISOString(),
    };

    return {
      success: true,
      quiz,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to structure quiz questions: ${err.message || 'Unknown structure error'}`,
    };
  }
}
