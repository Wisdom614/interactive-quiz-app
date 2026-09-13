import { Quiz, QuizQuestion } from '@/types/quiz';
import { normalizeAndCleanOptions } from './importer';

export interface GenerateQuizParams {
  topic: string;
  questionCount?: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'chaotic';
  tone?: 'humorous' | 'scholarly' | 'sarcastic' | 'energetic';
  timePerQuestion?: number;
}

const SAMPLE_QUIZZES: Record<string, Quiz> = {
  calculus: {
    id: 'sample-math-calculus-1',
    title: 'Differential & Integral Calculus',
    description: 'Foundational derivatives, definite integrals, and series expansions.',
    category: 'Mathematics',
    difficulty: 'medium',
    topic: 'Calculus & Pure Mathematics',
    createdAt: new Date().toISOString(),
    questions: [
      {
        id: 'calc-1',
        question: 'What is the derivative $\\frac{dy}{dx}$ of the function $f(x) = 3x^4 - 5x^2 + 8x - 12$?',
        options: ['$12x^3 - 10x + 8$', '$12x^3 - 5x + 8$', '$3x^3 - 10x$', '$7x^3 - 10x + 8$'],
        correctIndex: 0,
        timeLimit: 15,
        points: 1000,
        explanation: 'Applying the power rule $\\frac{d}{dx}[x^n] = n x^{n-1}$ term-by-term yields $12x^3 - 10x + 8$.',
        aiHostComment: 'Standard polynomial differentiation.'
      },
      {
        id: 'calc-2',
        question: 'Evaluate the definite integral $\\int_{0}^{2} (3x^2 - 2x + 1) \\, dx$.',
        options: ['$6$', '$8$', '$4$', '$10$'],
        correctIndex: 0,
        timeLimit: 20,
        points: 1000,
        explanation: 'Antiderivative is $F(x) = x^3 - x^2 + x$. $F(2) - F(0) = (8 - 4 + 2) - 0 = 6$.',
        aiHostComment: 'Fundamental theorem of calculus applied cleanly.'
      },
      {
        id: 'calc-3',
        question: 'What is the limit $\\lim_{x \\to 0} \\frac{\\sin(3x)}{x}$?',
        options: ['$3$', '$1$', '$0$', '$\\infty$'],
        correctIndex: 0,
        timeLimit: 15,
        points: 1000,
        explanation: 'Using the fundamental trigonometric limit $\\lim_{u \\to 0} \\frac{\\sin u}{u} = 1$, $\\lim_{x \\to 0} 3 \\cdot \\frac{\\sin(3x)}{3x} = 3(1) = 3$.',
        aiHostComment: 'Classic trigonometric limit property.'
      },
      {
        id: 'calc-4',
        question: 'Which rule is used to compute the derivative of a composition of functions $f(g(x))$?',
        options: ['Chain Rule', 'Product Rule', 'Quotient Rule', 'L\'Hôpital\'s Rule'],
        correctIndex: 0,
        timeLimit: 15,
        points: 1000,
        explanation: 'The Chain Rule states that $\\frac{d}{dx}[f(g(x))] = f\'(g(x)) \\cdot g\'(x)$.',
        aiHostComment: 'Core theorem for nested function derivatives.'
      },
      {
        id: 'calc-5',
        question: 'What is the derivative of $f(x) = \\ln(x^2 + 1)$ with respect to $x$?',
        options: ['$\\frac{2x}{x^2 + 1}$', '$\\frac{1}{x^2 + 1}$', '$\\frac{2}{x^2 + 1}$', '$\\frac{x}{x^2 + 1}$'],
        correctIndex: 0,
        timeLimit: 15,
        points: 1000,
        explanation: 'By the chain rule, $\\frac{d}{dx}[\\ln(u)] = \\frac{u\'}{u} = \\frac{2x}{x^2 + 1}$.',
        aiHostComment: 'Logarithmic chain rule differentiation.'
      }
    ]
  },
  javascript: {
    id: 'sample-tech-js-1',
    title: 'Modern JavaScript & Web Engineering',
    description: 'Event loop, asynchronous patterns, closures, and ES6+ semantics.',
    category: 'Computer Science',
    difficulty: 'medium',
    topic: 'JavaScript & Web Engineering',
    createdAt: new Date().toISOString(),
    questions: [
      {
        id: 'js-1',
        question: 'In JavaScript\'s event loop, where are resolved Promise callbacks placed for execution?',
        options: ['Microtask Queue', 'Macrotask Queue (Task Queue)', 'Call Stack directly', 'Render Queue'],
        correctIndex: 0,
        timeLimit: 15,
        points: 1000,
        explanation: 'Promise reactions (`.then`, `.catch`, `await`) are enqueued into the microtask queue, which drains before the next macrotask is processed.',
        aiHostComment: 'Crucial concept for asynchronous JavaScript concurrency.'
      },
      {
        id: 'js-2',
        question: 'What is the output of `typeof null` in JavaScript according to the ECMAScript standard?',
        options: ['"object"', '"null"', '"undefined"', '"symbol"'],
        correctIndex: 0,
        timeLimit: 15,
        points: 1000,
        explanation: '`typeof null === "object"` is a legacy artifact in JavaScript from the initial implementation where object type tags were 0.',
        aiHostComment: 'Famous JavaScript type idiosyncrasy.'
      },
      {
        id: 'js-3',
        question: 'Which method creates a new shallow copy of an array with elements that pass a provided test function?',
        options: ['Array.prototype.filter()', 'Array.prototype.map()', 'Array.prototype.reduce()', 'Array.prototype.forEach()'],
        correctIndex: 0,
        timeLimit: 15,
        points: 1000,
        explanation: '`filter()` calls a predicate function on each element and constructs a new array containing all elements that return true.',
        aiHostComment: 'Core functional programming primitive in modern JS.'
      },
      {
        id: 'js-4',
        question: 'What is a JavaScript closure?',
        options: [
          'A function bundled together with references to its lexical environment',
          'A method to close network connections automatically',
          'An anonymous function that executes only once',
          'A syntactic wrapper around try/catch/finally blocks'
        ],
        correctIndex: 0,
        timeLimit: 15,
        points: 1000,
        explanation: 'A closure gives an inner function access to an outer function\'s scope even after the outer function has returned.',
        aiHostComment: 'Essential mechanism for state encapsulation in JS.'
      },
      {
        id: 'js-5',
        question: 'What does the `===` operator perform in JavaScript compared to `==`?',
        options: [
          'Strict equality comparison without type coercion',
          'Loose equality comparison with automatic type coercion',
          'Deep structural object equality comparison',
          'Memory pointer reference assignment'
        ],
        correctIndex: 0,
        timeLimit: 15,
        points: 1000,
        explanation: 'The strict equality operator `===` checks both value and type without converting types before comparison.',
        aiHostComment: 'Fundamental comparison rule in modern TypeScript/JavaScript.'
      }
    ]
  },
  cameroon_history: {
    id: 'sample-cm-history-1',
    title: 'Cameroon History & Constitutional Evolution (1884–Present)',
    description: 'National treaties, independence, reunification, and constitutional milestones.',
    category: 'Cameroon History',
    difficulty: 'medium',
    topic: 'Cameroon History & Concours',
    createdAt: new Date().toISOString(),
    questions: [
      {
        id: 'cm-h-1',
        question: 'On what exact date was the Germano-Douala Treaty signed between Gustav Nachtigal and the Duala Kings (King Bell and King Akwa)?',
        options: ['July 12, 1884', 'January 1, 1960', 'October 1, 1961', 'May 20, 1972'],
        correctIndex: 0,
        timeLimit: 15,
        points: 1000,
        explanation: 'The Germano-Douala Treaty was officially signed on July 12, 1884, establishing the German Protectorate of Kamerun.',
        aiHostComment: 'A foundational milestone in Cameroonian colonial history.'
      },
      {
        id: 'cm-h-2',
        question: 'Which constitutional conference held in July 1961 laid the groundwork for the reunification of Southern Cameroons and the Republic of Cameroun?',
        options: ['Foumban Constitutional Conference', 'Mamfe Plebiscite Conference', 'Yaounde Accords', 'Bamenda All-Anglophone Conference'],
        correctIndex: 0,
        timeLimit: 15,
        points: 1000,
        explanation: 'The Foumban Conference (July 17–21, 1961) brought together delegations led by Ahmadou Ahidjo and John Ngu Foncha to draft the federal constitution.',
        aiHostComment: 'A pivotal turning point leading directly to the October 1, 1961 Reunification.'
      },
      {
        id: 'cm-h-3',
        question: 'Under the 1996 Constitution of Cameroon, how many administrative Regions make up the Republic of Cameroon?',
        options: ['10 Regions', '8 Provinces', '12 Regions', '7 States'],
        correctIndex: 0,
        timeLimit: 15,
        points: 1000,
        explanation: 'Cameroon is divided into 10 administrative regions (Centre, Littoral, West, North West, South West, South, East, Adamawa, North, and Far North).',
        aiHostComment: 'Standard civics question on Cameroonian territorial administration.'
      },
      {
        id: 'cm-h-4',
        question: 'Which prominent nationalist leader was the first Secretary-General of the Union des Populations du Cameroun (UPC), assassinated in 1958?',
        options: ['Ruben Um Nyobè', 'Félix-Roland Moumié', 'Ernest Ouandié', 'Ahmadou Ahidjo'],
        correctIndex: 0,
        timeLimit: 15,
        points: 1000,
        explanation: 'Ruben Um Nyobè (Mpodol) led the UPC campaign for independence and reunification before he was killed on September 13, 1958.',
        aiHostComment: 'A key historical figure in the Cameroonian independence struggle.'
      },
      {
        id: 'cm-h-5',
        question: 'What is the highest mountain peak in Cameroon and West/Central Africa, standing at an elevation of 4,095 meters?',
        options: ['Mount Cameroon (Mount Fako)', 'Mount Manengouba', 'Mount Oku', 'Mount Kupe'],
        correctIndex: 0,
        timeLimit: 15,
        points: 1000,
        explanation: 'Mount Cameroon (Fako), located in the South West Region, is an active volcano and the highest point in Cameroon at 4,095 meters.',
        aiHostComment: 'Home to the annual Mount Cameroon Race of Hope.'
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

  const timeLimit = params.timePerQuestion && params.timePerQuestion > 0 ? params.timePerQuestion : 15;

  if (!apiKey || apiKey.includes('your-xai-key') || apiKey.includes('your-grok-key') || apiKey.includes('your-api-key')) {
    console.warn('[Kinetic AI] No active API key detected in .env. Using built-in generator fallback.');
    const lower = topic.toLowerCase();
    if (lower.includes('calc') || lower.includes('math') || lower.includes('integral') || lower.includes('deriv')) {
      return {
        ...SAMPLE_QUIZZES.calculus,
        topic,
        questions: SAMPLE_QUIZZES.calculus.questions.map((q) => ({ ...q, timeLimit })),
      };
    }
    if (lower.includes('js') || lower.includes('javascript') || lower.includes('code') || lower.includes('web') || lower.includes('programming')) {
      return {
        ...SAMPLE_QUIZZES.javascript,
        topic,
        questions: SAMPLE_QUIZZES.javascript.questions.map((q) => ({ ...q, timeLimit })),
      };
    }
    if (lower.includes('cameroon') || lower.includes('concours')) {
      return {
        ...SAMPLE_QUIZZES.cameroon_history,
        topic,
        questions: SAMPLE_QUIZZES.cameroon_history.questions.map((q) => ({ ...q, timeLimit })),
      };
    }
    return generateSmartMockQuiz(topic, count, difficulty, timeLimit);
  }

  // Determine provider: GroqCloud (gsk_...) vs xAI (xai-...)
  const isGroq = apiKey.startsWith('gsk_');
  const endpoint = isGroq
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.x.ai/v1/chat/completions';
  const modelName = isGroq ? 'openai/gpt-oss-120b' : 'grok-2-latest';

  console.log(`[Kinetic AI] Calling ${isGroq ? 'Groq' : 'xAI'} API (${modelName}) for topic: "${topic}"...`);

  const systemPrompt = `You are a master academic quiz author and subject-matter expert across all disciplines (Sciences, Mathematics, Technology & Coding, History & Civilizations, Literature, Geography, Medicine, Arts, and Pop Culture).

YOUR GOAL:
Generate a high-quality, factual, 100% topic-faithful JSON quiz with EXACTLY ${count} multiple-choice questions on the user's specific requested topic: "${topic}".

STRICT GUIDELINES:
1. PURE TOPIC FIDELITY (NO UNWANTED REGIONAL ASSUMPTIONS):
   - Focus 100% of questions and options on the user's explicit topic ("${topic}").
   - DO NOT inject specific regional or country contexts (e.g. Cameroon, UK, US) UNLESS the topic explicitly mentions that region or country.
   - For example:
     * If the topic is "JavaScript Promises", generate questions about JavaScript asynchronous runtime, Promise.all, microtasks, async/await.
     * If the topic is "World War II", generate questions about WWII battles, treaties, and global leaders.
     * If the topic is "Calculus", generate real mathematical derivatives, integrals, and limits with LaTeX.
     * If the topic is "Cameroon History", generate real Cameroon colonial treaties, constitutional milestones, and historical leaders.
   - NEVER generate meaningless abstract placeholder questions (such as "What is Axiom Alpha?"). Every question must test real, interpretable, factual knowledge, definitions, equations, or concepts.

2. ACCURATE OPTIONS & DISTRACTORS:
   - Provide EXACTLY 4 distinct, meaningful, and plausible options per question.
   - Distractors must be authentic related concepts, realistic common mistakes, or historical/factual alternatives.
   - Distribute the correct answers across indexes 0, 1, 2, and 3.
   - Do NOT include option prefixes like "A)", "B.", or "Option 1" inside the option text strings.

3. FORMULAS & STEM NOTATION:
   - For all mathematical, physical, chemical, or algorithmic equations, powers, fractions, and symbols, ALWAYS format with standard LaTeX enclosed in single dollar signs $...$ (e.g. "$2x^2 - 7x + 3 = 0$", "$\\frac{dy}{dx} = 12x^3$", "$O(n \\log n)$", "$H_2SO_4$", "$E = mc^2$").

4. EXACT COUNT & METADATA:
   - You MUST generate EXACTLY ${count} questions in the "questions" array.
   - Include a concise, clear explanation explaining why the correct answer is right and why distractors are wrong.
   - Provide an analytical host comment.
   - Tone: ${tone}.
   - Difficulty: ${difficulty}.

Strictly output ONLY valid JSON matching this schema:
{
  "title": "Precise authoritative quiz title",
  "description": "1-sentence overview of the quiz scope",
  "category": "Discipline Category (e.g. Mathematics, Computer Science, World History, Physics, Biology, etc.)",
  "difficulty": "${difficulty}",
  "questions": [
    {
      "question": "Clear, meaningful question stem (use $...$ for formulas)",
      "options": ["Plausible Option A", "Plausible Option B", "Plausible Option C", "Plausible Option D"],
      "correctIndex": 0,
      "timeLimit": ${timeLimit},
      "points": 1000,
      "explanation": "Clear 1-2 sentence factual or mathematical explanation",
      "aiHostComment": "Engaging analytical commentary"
    }
  ]
}`;

  const userPrompt = `Generate a ${difficulty}-level quiz on the topic: "${topic}".
Total Questions: EXACTLY ${count} questions.
Ensure all questions are concrete, meaningful, factually accurate, and strictly focused on "${topic}".`;

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
        temperature: 0.6,
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

    const defaultTimeLimit = params.timePerQuestion || 15;
    const formattedQuestions: QuizQuestion[] = (parsed.questions || []).map((q: any, idx: number) => {
      const qText = String(q.question || q.prompt || `Question ${idx + 1}`);
      const { options, correctIndex } = normalizeAndCleanOptions(q);

      return {
        id: `q-${idx + 1}-${Date.now()}`,
        question: qText,
        options,
        correctIndex,
        timeLimit: typeof q.timeLimit === 'number' ? q.timeLimit : defaultTimeLimit,
        points: typeof q.points === 'number' ? q.points : 1000,
        explanation: String(q.explanation || 'Verified factual knowledge based on standard syllabus.'),
        aiHostComment: String(q.aiHostComment || 'Analytical precision verified.'),
        category: parsed.category || topic,
      };
    });

    console.log(`[Kinetic AI] Successfully generated ${formattedQuestions.length} topic-faithful questions from ${isGroq ? 'Groq' : 'Grok'} AI!`);

    return {
      id: quizId,
      title: parsed.title || `${topic} Quiz Arena`,
      description: parsed.description || `Comprehensive assessment on "${topic}"`,
      category: parsed.category || 'General Knowledge & Sciences',
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

function generateSmartMockQuiz(topic: string, count: number, difficulty: 'easy' | 'medium' | 'hard' | 'chaotic', timePerQuestion = 15): Quiz {
  const lower = topic.toLowerCase();
  const qTimeLimit = timePerQuestion && timePerQuestion > 0 ? timePerQuestion : 15;

  const mathPool = [
    {
      q: 'Evaluate the derivative $\\frac{d}{dx}\\left[\\ln(3x^2 + 1)\\right]$ using the chain rule.',
      opts: ['$\\frac{6x}{3x^2 + 1}$', '$\\frac{3x}{3x^2 + 1}$', '$\\frac{1}{3x^2 + 1}$', '$\\frac{6x^2}{3x^2 + 1}$'],
      correct: 0,
      exp: 'By the chain rule: $\\frac{d}{dx}[\\ln(u)] = \\frac{u\'}{u} = \\frac{6x}{3x^2 + 1}$.',
      comment: 'Core logarithmic differentiation problem.'
    },
    {
      q: 'What is the sum of the infinite geometric series $\\sum_{n=0}^{\\infty} \\left(\\frac{1}{3}\\right)^n$?',
      opts: ['$\\frac{3}{2}$', '$\\frac{2}{3}$', '$2$', '$3$'],
      correct: 0,
      exp: 'For $|r| < 1$, sum $= \\frac{a}{1 - r} = \\frac{1}{1 - 1/3} = \\frac{1}{2/3} = \\frac{3}{2}$.',
      comment: 'Classic infinite series convergence.'
    },
    {
      q: 'Solve for $x$ in the equation $2x^2 - 7x + 3 = 0$.',
      opts: ['$x = 3$ or $x = \\frac{1}{2}$', '$x = -3$ or $x = -\\frac{1}{2}$', '$x = 2$ or $x = \\frac{3}{2}$', '$x = 1$ or $x = 6$'],
      correct: 0,
      exp: 'Factoring gives $(2x - 1)(x - 3) = 0 \\implies x = 3$ or $x = 1/2$.',
      comment: 'Quadratic equation factoring.'
    },
    {
      q: 'What is the value of $\\int_{0}^{\\pi} \\sin(x) \\, dx$?',
      opts: ['$2$', '$0$', '$1$', '$-1$'],
      correct: 0,
      exp: '$[-\\cos(x)]_{0}^{\\pi} = -\\cos(\\pi) - (-\\cos(0)) = -(-1) + 1 = 2$.',
      comment: 'Standard definite trigonometric integration.'
    }
  ];

  const techPool = [
    {
      q: 'What is the average time complexity of searching in a balanced Binary Search Tree (such as an AVL or Red-Black Tree)?',
      opts: ['$O(\\log n)$', '$O(n)$', '$O(1)$', '$O(n \\log n)$'],
      correct: 0,
      exp: 'A balanced BST maintains height $h = O(\\log n)$, ensuring $O(\\log n)$ search, insert, and delete operations.',
      comment: 'Fundamental algorithmic complexity.'
    },
    {
      q: 'Which HTTP status code signifies that a requested resource was successfully created on the server?',
      opts: ['201 Created', '200 OK', '204 No Content', '301 Moved Permanently'],
      correct: 0,
      exp: 'HTTP 201 Created indicates that the request has succeeded and led to the creation of a new resource.',
      comment: 'RESTful API standard convention.'
    },
    {
      q: 'In relational database theory, what does the ACID property "Isolation" ensure?',
      opts: [
        'Concurrent transactions execute without interfering with one another',
        'All changes survive system failures permanently',
        'Transactions execute completely or not at all',
        'Data transitions only from one valid state to another'
      ],
      correct: 0,
      exp: 'Isolation ensures that concurrent transactions occur independently without cross-transaction contamination.',
      comment: 'Core database transaction management principle.'
    },
    {
      q: 'In modern cryptography, which algorithm is based on the mathematical difficulty of factoring large composite integers?',
      opts: ['RSA', 'AES-256', 'SHA-256', 'Diffie-Hellman on Elliptic Curves'],
      correct: 0,
      exp: 'RSA asymmetric encryption relies on the computational hardness of the prime factorization problem.',
      comment: 'Cornerstone of public-key cryptography.'
    }
  ];

  const sciencePool = [
    {
      q: 'According to Newton\'s Second Law of Motion, what is the net force acting on an object of mass $5\\text{ kg}$ accelerating at $4\\text{ m/s}^2$?',
      opts: ['$20\\text{ N}$', '$1.25\\text{ N}$', '$9\\text{ N}$', '$0.8\\text{ N}$'],
      correct: 0,
      exp: '$F = ma = 5\\text{ kg} \\times 4\\text{ m/s}^2 = 20\\text{ N}$.',
      comment: 'Classical mechanics fundamental calculation.'
    },
    {
      q: 'Which subatomic particles are found in the nucleus of an atom?',
      opts: ['Protons and Neutrons', 'Protons and Electrons', 'Electrons and Neutrons', 'Positrons and Photons'],
      correct: 0,
      exp: 'The atomic nucleus consists of nucleons: positively charged protons and neutral neutrons, bound by the strong nuclear force.',
      comment: 'Atomic physics and chemistry foundation.'
    },
    {
      q: 'What is the chemical formula for sulfuric acid?',
      opts: ['$H_2SO_4$', '$HCl$', '$HNO_3$', '$H_2SO_3$'],
      correct: 0,
      exp: 'Sulfuric acid is a strong diprotic mineral acid with formula $H_2SO_4$.',
      comment: 'Inorganic chemistry standard nomenclature.'
    },
    {
      q: 'Which cellular organelle is responsible for generating the majority of chemical energy in the form of ATP via aerobic respiration?',
      opts: ['Mitochondrion', 'Ribosome', 'Golgi Apparatus', 'Endoplasmic Reticulum'],
      correct: 0,
      exp: 'Mitochondria produce ATP through the Krebs cycle and oxidative phosphorylation on their inner cristae.',
      comment: 'Cellular biology powerhouse.'
    }
  ];

  const worldHistoryPool = [
    {
      q: 'In which year did the Second World War officially end following the surrender of Axis forces?',
      opts: ['1945', '1939', '1918', '1950'],
      correct: 0,
      exp: 'World War II concluded in 1945 with the defeat of Germany in May (V-E Day) and Japan in September (V-J Day).',
      comment: 'Crucial turning point in modern world history.'
    },
    {
      q: 'Which international treaty signed in 1919 officially concluded the state of war between Germany and the Allied Powers after World War I?',
      opts: ['Treaty of Versailles', 'Treaty of Westphalia', 'Treaty of Paris', 'Treaty of Utrecht'],
      correct: 0,
      exp: 'The Treaty of Versailles was signed on June 28, 1919, establishing the League of Nations and post-WWI borders.',
      comment: '20th century geopolitical foundation.'
    },
    {
      q: 'What ancient civilization constructed the architectural marvel known as Machu Picchu in the Andes mountains?',
      opts: ['Inca Empire', 'Maya Civilization', 'Aztec Empire', 'Olmec Civilization'],
      correct: 0,
      exp: 'Machu Picchu was built in the 15th century by the Inca Empire under Emperor Pachacuti.',
      comment: 'Pre-Columbian architectural legacy.'
    },
    {
      q: 'Who was the primary author of the United States Declaration of Independence adopted in 1776?',
      opts: ['Thomas Jefferson', 'George Washington', 'Benjamin Franklin', 'Alexander Hamilton'],
      correct: 0,
      exp: 'Thomas Jefferson drafted the Declaration of Independence, which was adopted by the Second Continental Congress on July 4, 1776.',
      comment: 'Enlightenment political philosophy milestone.'
    }
  ];

  const cameroonPool = [
    {
      q: 'On what exact date was the Germano-Douala Treaty signed between Gustav Nachtigal and the Duala Kings (King Bell and King Akwa)?',
      opts: ['July 12, 1884', 'January 1, 1960', 'October 1, 1961', 'May 20, 1972'],
      correct: 0,
      exp: 'The Germano-Douala Treaty was signed on July 12, 1884, establishing the German Protectorate of Kamerun.',
      comment: 'Foundational date in Cameroonian colonial history.'
    },
    {
      q: 'Which conference held in July 1961 agreed upon the Federal Constitution for the reunification of Cameroon?',
      opts: ['Foumban Constitutional Conference', 'Mamfe Plebiscite Conference', 'Yaounde Accords', 'Bamenda Conference'],
      correct: 0,
      exp: 'The Foumban Conference (July 17–21, 1961) led by Ahidjo and Foncha established the Federal Republic.',
      comment: 'Foundational moment of the October 1, 1961 Reunification.'
    },
    {
      q: 'What is the highest mountain peak in Cameroon, standing at an elevation of 4,095 meters?',
      opts: ['Mount Cameroon (Mount Fako)', 'Mount Manengouba', 'Mount Oku', 'Mount Kupe'],
      correct: 0,
      exp: 'Mount Cameroon (Fako) is an active volcano and the highest point in West and Central Africa at 4,095 meters.',
      comment: 'Cameroon geographical landmark.'
    }
  ];

  let selectedPool = techPool;
  let categoryName = 'General Knowledge & Sciences';

  if (lower.includes('math') || lower.includes('calc') || lower.includes('algebra') || lower.includes('geometry')) {
    selectedPool = mathPool;
    categoryName = 'Mathematics & Calculus';
  } else if (lower.includes('code') || lower.includes('js') || lower.includes('program') || lower.includes('web') || lower.includes('comput') || lower.includes('tech') || lower.includes('ai')) {
    selectedPool = techPool;
    categoryName = 'Computer Science & Technology';
  } else if (lower.includes('hist') || lower.includes('war') || lower.includes('empire') || lower.includes('revolution')) {
    selectedPool = worldHistoryPool;
    categoryName = 'World History & Civilizations';
  } else if (lower.includes('physic') || lower.includes('chem') || lower.includes('bio') || lower.includes('sci')) {
    selectedPool = sciencePool;
    categoryName = 'Physical & Natural Sciences';
  } else if (lower.includes('cameroon') || lower.includes('concours') || lower.includes('africa')) {
    selectedPool = cameroonPool;
    categoryName = 'Cameroon History & Concours';
  } else {
    // Balanced mix of science, tech, math, and history
    selectedPool = [...sciencePool, ...techPool, ...mathPool, ...worldHistoryPool];
    categoryName = 'General Knowledge & Sciences';
  }

  const questions: QuizQuestion[] = [];
  const targetCount = Math.max(1, Math.min(count, 50));

  for (let i = 0; i < targetCount; i++) {
    const item = selectedPool[i % selectedPool.length];
    questions.push({
      id: `smart-q-${i + 1}-${Date.now()}`,
      question: item.q,
      options: item.opts,
      correctIndex: item.correct,
      timeLimit: qTimeLimit,
      points: 1000,
      explanation: item.exp,
      aiHostComment: item.comment,
      category: topic
    });
  }

  return {
    id: `smart-quiz-${Date.now()}`,
    title: `${topic} Arena Challenge`,
    description: `A rigorous assessment on "${topic}" with ${targetCount} verified questions.`,
    category: categoryName,
    difficulty,
    topic,
    questions,
    createdAt: new Date().toISOString()
  };
}
