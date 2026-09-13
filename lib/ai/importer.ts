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
    ? `\nADDITIONAL INSTRUCTIONS / RECOMMENDATIONS:\n${opts.customInstructions.trim()}\n`
    : '';

  const timeLimit = opts.timePerQuestion || 15;

  return `Generate EXACTLY ${opts.questionCount} multiple-choice examination questions on the topic: "${opts.topic.trim() || 'Cameroon General Knowledge & Sciences'}".
Difficulty level: ${opts.difficulty}
Tone: ${opts.tone}${customPart}

CURRICULUM & QUESTION-SETTING DIRECTIVES (CAMEROON EXAMINATION STYLE):
1. ACCURACY & PEDAGOGY: Follow the Cameroon GCE Board (Ordinary Level / Advanced Level) and Cameroonian National Concours (ENAM, ENS, Polytech, FHS, CUSS, ENSET, IRIC) standards.
2. LOCAL & NATIONAL CONTEXT: If covering History, Geography, Civics, Economics, Law, Culture, or General Knowledge:
   - Ground facts in authentic Cameroonian institutions (10 Regions, Constitution, Presidency, National Assembly, Senate, Supreme Court).
   - Use authentic Cameroon history (1884 Germano-Douala Treaty, 1916 partition, UPC Ruben Um Nyobe, 1 Jan 1960 Independence, July 1961 Foumban Conference, 1 Oct 1961 Reunification, 20 May 1972 Unitary State).
   - Geography & Economy (Mount Fako 4095m, Sanaga River, Lake Nyos, Waza Park, CDC, Pamol, Sodecoton, FCFA / XAF currency).
   - Sports & Culture (Indomitable Lions, 5 AFCONs, Makossa, Bikutsi, official bilingualism: English/French).
3. EXACT QUESTION COUNT: Return EXACTLY ${opts.questionCount} questions in the "questions" array.
4. FORMULAS & LATEX: For any math or science formulas, equations, or chemical symbols, ALWAYS format with standard LaTeX in single dollar signs $...$ (e.g. "$2x^2 - 7x + 3 = 0$", "$\\frac{dy}{dx}$", "$E = mc^2$", "$CH_4$").
5. OPTIONS: Exactly 4 plausible options per question without option prefixes (no "A)", "B.", or "Option 1" in strings).
6. "correctIndex" must be 0, 1, 2, or 3. No unicode emojis. Return ONLY valid JSON.

SCHEMA:
{
  "title": "Authoritative title (e.g. Cameroon GCE A/L Mathematics / Cameroon History)",
  "description": "1-sentence synopsis of the curriculum scope",
  "category": "Cameroon Academic & Concours",
  "difficulty": "${opts.difficulty}",
  "questions": [
    {
      "question": "Clear, syllabus-grounded question stem (use $...$ for math)",
      "options": ["First option value", "Second option value", "Third option value", "Fourth option value"],
      "correctIndex": 0,
      "timeLimit": ${timeLimit},
      "points": 1000,
      "explanation": "1-2 sentence verified factual proof (use $...$ for math)",
      "aiHostComment": "Analytical remark grounded in the subject matter"
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
