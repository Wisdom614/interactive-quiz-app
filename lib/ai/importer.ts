import { Quiz, QuizQuestion } from '@/types/quiz';

export interface PromptTemplateOptions {
  topic: string;
  questionCount: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'chaotic';
  tone: 'scholarly' | 'humorous' | 'sarcastic' | 'energetic';
  customInstructions?: string;
}

/**
 * Builds an optimal prompt that any external AI (ChatGPT, Claude, DeepSeek, Grok, Gemini)
 * will easily understand and return clean JSON quiz questions for our system.
 */
export function generateExternalAIPrompt(opts: PromptTemplateOptions): string {
  const customPart = opts.customInstructions?.trim()
    ? `\nADDITIONAL INSTRUCTIONS / RECOMMENDATIONS:\n${opts.customInstructions.trim()}\n`
    : '';

  return `Generate exactly ${opts.questionCount} multiple-choice trivia questions about "${opts.topic.trim() || 'General Knowledge'}".
Difficulty level: ${opts.difficulty}
Tone: ${opts.tone}${customPart}

CRITICAL FORMATTING INSTRUCTIONS:
1. Return ONLY a valid JSON object matching the schema below. Do not wrap in conversational text.
2. For any mathematics, physics, engineering, or chemistry formulas, equations, or scientific symbols, ALWAYS format them using standard LaTeX enclosed in single dollar signs $...$ (e.g. "$f(x) = x^2 + 4x + 4$", "$\\frac{d}{dx}[\\sin x] = \\cos x$", "$\\sqrt{a^2 + b^2}$", "$\\int_0^1 x^2 dx = \\frac{1}{3}$", "$E = mc^2$").
3. Ensure each question has EXACTLY 4 plausible options, and correctIndex is an integer from 0 to 3 corresponding to the correct option.
4. Do NOT use unicode emojis. Keep language punchy, accurate, and engaging.

SCHEMA:
{
  "title": "Compelling and concise quiz title",
  "description": "1-sentence synopsis of the quiz",
  "category": "Domain (e.g. Mathematics, Science, Tech, History, Movies)",
  "difficulty": "${opts.difficulty}",
  "questions": [
    {
      "question": "Clear and unambiguous question (use $...$ for math)",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "timeLimit": 15,
      "points": 1000,
      "explanation": "1-2 sentence verified factual explanation",
      "aiHostComment": "A sharp, witty 1-sentence analytical remark (no emojis)"
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
      
      // Options handling
      let options: string[] = [];
      if (Array.isArray(q.options)) {
        options = q.options.map((opt: any) => String(opt));
      } else if (Array.isArray(q.choices)) {
        options = q.choices.map((opt: any) => String(opt));
      } else if (Array.isArray(q.answers)) {
        options = q.answers.map((opt: any) => String(opt));
      } else if (q.options && typeof q.options === 'object') {
        // e.g. { "A": "...", "B": "...", "C": "...", "D": "..." }
        options = Object.values(q.options).map((opt: any) => String(opt));
      }

      // Pad or trim to exactly 4 options
      while (options.length < 4) {
        options.push(`Option ${String.fromCharCode(65 + options.length)}`);
      }
      if (options.length > 4) {
        options = options.slice(0, 4);
      }

      // Correct Index detection
      let correctIndex = 0;
      if (typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex <= 3) {
        correctIndex = q.correctIndex;
      } else if (typeof q.correct_index === 'number' && q.correct_index >= 0 && q.correct_index <= 3) {
        correctIndex = q.correct_index;
      } else if (typeof q.correctAnswerIndex === 'number' && q.correctAnswerIndex >= 0 && q.correctAnswerIndex <= 3) {
        correctIndex = q.correctAnswerIndex;
      } else if (typeof q.answerIndex === 'number' && q.answerIndex >= 0 && q.answerIndex <= 3) {
        correctIndex = q.answerIndex;
      } else if (typeof q.correctAnswer === 'string' || typeof q.answer === 'string' || typeof q.correct_answer === 'string') {
        const ansStr = String(q.correctAnswer || q.answer || q.correct_answer).trim();
        // Check if ansStr is "0", "1", "2", "3" or "A", "B", "C", "D"
        const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, a: 0, b: 1, c: 2, d: 3 };
        if (letterMap[ansStr] !== undefined) {
          correctIndex = letterMap[ansStr];
        } else if (['0', '1', '2', '3'].includes(ansStr)) {
          correctIndex = parseInt(ansStr, 10);
        } else {
          // Find option that matches string
          const foundIdx = options.findIndex((opt) => opt.toLowerCase().trim() === ansStr.toLowerCase().trim());
          if (foundIdx !== -1) {
            correctIndex = foundIdx;
          }
        }
      }

      return {
        id: `q-imported-${idx + 1}-${Date.now()}`,
        question: qText,
        options,
        correctIndex,
        timeLimit: typeof q.timeLimit === 'number' ? q.timeLimit : 15,
        points: typeof q.points === 'number' ? q.points : 1000,
        explanation: String(q.explanation || q.rationale || 'Verified fact.'),
        aiHostComment: String(q.aiHostComment || q.comment || 'Precision verified.'),
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
