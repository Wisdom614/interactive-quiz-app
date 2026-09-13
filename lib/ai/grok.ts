import { Quiz, QuizQuestion } from '@/types/quiz';

export interface GenerateQuizParams {
  topic: string;
  questionCount?: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'chaotic';
  tone?: 'humorous' | 'scholarly' | 'sarcastic' | 'energetic';
}

const SAMPLE_QUIZZES: Record<string, Quiz> = {
  tech: {
    id: 'sample-tech-1',
    title: 'Code & Systems: Computing & AI Lore',
    description: 'Precision trivia on algorithms, AI history, and computer science breakthroughs.',
    category: 'Technology & AI',
    difficulty: 'medium',
    topic: 'Tech & AI',
    createdAt: new Date().toISOString(),
    questions: [
      {
        id: 'q1',
        question: 'Which programming language was originally designated "Oak" before its public release in 1995?',
        options: ['Python', 'Java', 'Ruby', 'C++'],
        correctIndex: 1,
        timeLimit: 15,
        points: 1000,
        explanation: 'James Gosling named the language after an oak tree outside his office before it was renamed Java.',
        aiHostComment: 'Classic systems lore: Java fueled the early enterprise web.'
      },
      {
        id: 'q2',
        question: 'What does the "G" in the acronym "GPT" represent?',
        options: ['General', 'Generative', 'Global', 'Guided'],
        correctIndex: 1,
        timeLimit: 15,
        points: 1000,
        explanation: 'GPT represents Generative Pre-trained Transformer, introduced in seminal NLP research.',
        aiHostComment: 'Correct. Generative architectures transformed language intelligence.'
      },
      {
        id: 'q3',
        question: 'In standard RFC documentation, what does the HTTP 418 status code represent?',
        options: ['Payment Required', 'I am a teapot', 'Enhance Your Calm', 'Bad Gateway'],
        correctIndex: 1,
        timeLimit: 15,
        points: 1000,
        explanation: 'HTTP 418 "I\'m a teapot" was defined in RFC 2324 as an April Fools\' engineering specification in 1998.',
        aiHostComment: 'RFC 2324 remains the most memorable easter egg in internet protocol history.'
      },
      {
        id: 'q4',
        question: 'Who is recognized for developing the first published algorithm for the mechanical Analytical Engine in 1843?',
        options: ['Grace Hopper', 'Ada Lovelace', 'Alan Turing', 'Margaret Hamilton'],
        correctIndex: 1,
        timeLimit: 15,
        points: 1000,
        explanation: 'Ada Lovelace translated and annotated Menabrea\'s paper on the Analytical Engine, creating algorithm notes.',
        aiHostComment: 'A foundational pioneer of modern algorithmic theory.'
      },
      {
        id: 'q5',
        question: 'What was the first commercial .com domain name officially registered on the internet in 1985?',
        options: ['symbolics.com', 'google.com', 'apple.com', 'ibm.com'],
        correctIndex: 0,
        timeLimit: 15,
        points: 1000,
        explanation: 'Symbolics.com was registered on March 15, 1985 by Symbolics Computer Corporation.',
        aiHostComment: 'The very first anchor in DNS history.'
      }
    ]
  },
  popculture: {
    id: 'sample-pop-1',
    title: 'Modern Cinema, Music & Culture Matrix',
    description: 'A fast-paced showdown across modern cinema milestones and music history.',
    category: 'Pop Culture & Media',
    difficulty: 'easy',
    topic: 'Movies & Culture',
    createdAt: new Date().toISOString(),
    questions: [
      {
        id: 'qp1',
        question: 'In the film "The Matrix" (1999), what color pill does Morpheus offer Neo to reveal the true reality?',
        options: ['Blue', 'Red', 'Green', 'Amber'],
        correctIndex: 1,
        timeLimit: 15,
        points: 1000,
        explanation: 'The red pill symbolizes confronting the truth, while the blue pill maintains blissful simulation.',
        aiHostComment: 'The red pill choice defined a generation of science fiction cinema.'
      },
      {
        id: 'qp2',
        question: 'Which recording artist holds the record for the most Grammy Awards won in music history?',
        options: ['Michael Jackson', 'Beyoncé', 'Taylor Swift', 'Quincy Jones'],
        correctIndex: 1,
        timeLimit: 15,
        points: 1000,
        explanation: 'Beyoncé holds the record with 32 Grammy Awards across her career.',
        aiHostComment: 'A dominant historical record across categories.'
      },
      {
        id: 'qp3',
        question: 'What is the highest-grossing box office film in cinematic history (unadjusted for inflation)?',
        options: ['Avengers: Endgame', 'Titanic', 'Avatar', 'Star Wars: The Force Awakens'],
        correctIndex: 2,
        timeLimit: 15,
        points: 1000,
        explanation: 'James Cameron\'s Avatar (2009) holds the all-time gross box office record at over $2.9 billion.',
        aiHostComment: 'James Cameron\'s world-building set a box office benchmark that still stands.'
      }
    ]
  }
};

export async function generateQuizWithGrok(params: GenerateQuizParams): Promise<Quiz> {
  const apiKey = (process.env.GROQ_API_KEY || process.env.XAI_API_KEY || process.env.GROK_API_KEY || '').trim();
  const count = params.questionCount || 5;
  const difficulty = params.difficulty || 'medium';
  const topic = params.topic.trim();
  const tone = params.tone || 'scholarly';

  if (!apiKey || apiKey.includes('your-xai-key') || apiKey.includes('your-grok-key') || apiKey.includes('your-api-key')) {
    console.warn('[Kinetic AI] No valid API key detected in .env. Using built-in generator fallback.');
    if (topic.toLowerCase().includes('pop') || topic.toLowerCase().includes('movie')) {
      return { ...SAMPLE_QUIZZES.popculture, topic };
    }
    if (topic.toLowerCase().includes('tech') || topic.toLowerCase().includes('code') || topic.toLowerCase().includes('ai')) {
      return { ...SAMPLE_QUIZZES.tech, topic };
    }
    return generateSmartMockQuiz(topic, count, difficulty);
  }

  // Determine provider: GroqCloud (gsk_...) vs xAI (xai-...)
  const isGroq = apiKey.startsWith('gsk_');
  const endpoint = isGroq
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.x.ai/v1/chat/completions';
  const modelName = isGroq ? 'openai/gpt-oss-20b' : 'grok-2-latest';

  console.log(`[Kinetic AI] Calling ${isGroq ? 'Groq' : 'xAI'} API (${modelName}) for topic: "${topic}"...`);

  const systemPrompt = `You are an intelligent, analytical, and highly accurate trivia question generator.
Generate a structured JSON quiz on the user's requested topic.
CRITICAL FORMATTING RULE: Do NOT include unicode emojis in the text. Keep all writing professional, punchy, clean, and engaging.
MATHEMATICS & SCIENTIFIC FORMULAS: For any math, physics, engineering, or chemistry questions, equations, powers, roots, fractions, Greek letters, or symbols, ALWAYS format them using standard LaTeX enclosed in single dollar signs $...$ (e.g. "$f(x) = x^2 + 4x + 4$", "$\\frac{d}{dx}[\\sin x] = \\cos x$", "$\\sqrt{a^2 + b^2}$", "$\\int_0^1 x^2 dx = \\frac{1}{3}$", "$E = mc^2$", "$\\lim_{x \\to 0}\\frac{\\sin x}{x} = 1$").
You must strictly return a valid JSON object matching this TypeScript interface without markdown quotes:

{
  "title": "Precise and compelling quiz title",
  "description": "Engaging 1-sentence synopsis",
  "category": "High level domain (e.g. Mathematics, Physics, Science, Engineering, History)",
  "difficulty": "${difficulty}",
  "questions": [
    {
      "question": "Clear, direct, and unambiguous question text (use $...$ for math equations)",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0, // 0, 1, 2, or 3
      "timeLimit": 15,
      "points": 1000,
      "explanation": "Clear 1-2 sentence breakdown of the correct fact",
      "aiHostComment": "A sharp, witty 1-sentence analytical remark (no emojis)"
    }
  ]
}

Ensure exactly 4 plausible options per question. Shuffle the correct answers evenly across index 0 to 3. Tone should be: ${tone}.`;

  const userPrompt = `Topic: "${topic}". Generate exactly ${count} trivia questions with difficulty level: "${difficulty}".`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[Kinetic AI] ${isGroq ? 'Groq' : 'xAI'} API call failed with status ${response.status}:`, errBody);
      return generateSmartMockQuiz(topic, count, difficulty);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.warn('[Kinetic AI] Empty content in AI response choices.');
      return generateSmartMockQuiz(topic, count, difficulty);
    }

    const parsed = JSON.parse(content);
    const quizId = (isGroq ? 'groq-' : 'grok-') + Date.now();

    const formattedQuestions: QuizQuestion[] = (parsed.questions || []).map((q: Partial<QuizQuestion>, idx: number) => ({
      id: `q-${idx + 1}-${Date.now()}`,
      question: q.question || `Question ${idx + 1}`,
      options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
      correctIndex: typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex <= 3 ? q.correctIndex : 0,
      timeLimit: q.timeLimit || 15,
      points: q.points || 1000,
      explanation: q.explanation || 'Verified factual knowledge.',
      aiHostComment: q.aiHostComment || 'Analytical precision verified.',
      category: parsed.category || topic
    }));

    console.log(`[Kinetic AI] Successfully generated ${formattedQuestions.length} questions from ${isGroq ? 'Groq' : 'Grok'} AI!`);

    return {
      id: quizId,
      title: parsed.title || `${topic} Knowledge Arena`,
      description: parsed.description || `Generated by AI on "${topic}"`,
      category: parsed.category || 'Custom AI',
      difficulty: difficulty,
      topic: topic,
      questions: formattedQuestions,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error(`[Kinetic AI] Exception while calling ${isGroq ? 'Groq' : 'xAI'} API:`, error);
    return generateSmartMockQuiz(topic, count, difficulty);
  }
}

function generateSmartMockQuiz(topic: string, count: number, difficulty: 'easy' | 'medium' | 'hard' | 'chaotic'): Quiz {
  const questions: QuizQuestion[] = [];
  const templates = [
    {
      q: `In the study of ${topic}, which primary principle provides the baseline theoretical foundation?`,
      opts: ['Fundamental Axiom Alpha', 'Secondary Heuristic Metric', 'Systemic Model Paradigm', 'Empirical Core Variance'],
      correct: 0,
      exp: `The foundational axiom establishes baseline principles for modeling and measuring ${topic}.`,
      comment: `First principles reasoning yields consistent clarity.`
    },
    {
      q: `Which breakthrough innovation transformed modern execution in ${topic}?`,
      opts: ['Manual Relay Methods', 'Autonomous Algorithmic Scaling', 'Static Memory Allocation', 'Linear Synchronous Bus'],
      correct: 1,
      exp: `Autonomous scaling unlocked orders-of-magnitude higher throughput in ${topic}.`,
      comment: `Scalability separates modern architectures from legacy systems.`
    },
    {
      q: `What is the most prevalent misconception encountered in ${topic}?`,
      opts: ['Zero entropy requirement', 'Infinite compute dependency', 'Equating complexity with performance', 'Linear historical origin in 1802'],
      correct: 2,
      exp: `Elegant and concise architectures consistently outperform over-engineered abstractions.`,
      comment: `Simplicity is the ultimate sophistication.`
    },
    {
      q: `When benchmarking optimal execution in ${topic}, which metric is most critical?`,
      opts: ['Latency and Throughput Equilibrium', 'Surface Area Complexity', 'Raw Code Volume', 'Clock Drift Tolerance'],
      correct: 0,
      exp: `Balancing low latency with high throughput defines system efficiency.`,
      comment: `Optimizing the critical path ensures peak response rates.`
    },
    {
      q: `What is forecasted to represent the next paradigm evolution in ${topic}?`,
      opts: ['Complete Deprecation', 'Adaptive Neural Integration', 'Analog Manual Controls', 'Single-Core Execution'],
      correct: 1,
      exp: `Adaptive neural intelligence integration is reshaping modern execution models.`,
      comment: `The shift toward adaptive cognitive architecture is underway.`
    }
  ];

  for (let i = 0; i < Math.min(count, 10); i++) {
    const t = templates[i % templates.length];
    questions.push({
      id: `smart-q-${i + 1}-${Date.now()}`,
      question: t.q,
      options: t.opts,
      correctIndex: t.correct,
      timeLimit: 15,
      points: 1000,
      explanation: t.exp,
      aiHostComment: t.comment,
      category: topic
    });
  }

  return {
    id: `smart-quiz-${Date.now()}`,
    title: `${topic} Master Arena`,
    description: `A fast-paced AI curated assessment exploring ${topic} at ${difficulty} level.`,
    category: topic,
    difficulty,
    topic,
    questions,
    createdAt: new Date().toISOString()
  };
}
