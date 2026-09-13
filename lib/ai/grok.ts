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
  cameroon_history: {
    id: 'sample-cm-history-1',
    title: 'Cameroon History & Constitutional Evolution (1884–Present)',
    description: 'Authentic Cameroon GCE & Concours preparation on national history, treaties, and constitutional milestones.',
    category: 'Cameroon History',
    difficulty: 'medium',
    topic: 'Cameroon History & Concours',
    createdAt: new Date().toISOString(),
    questions: [
      {
        id: 'cm-h-1',
        question: 'On what exact date was the Germano-Douala Treaty signed between German representative Gustav Nachtigal and the Duala Kings (King Bell and King Akwa)?',
        options: ['July 12, 1884', 'January 1, 1960', 'October 1, 1961', 'May 20, 1972'],
        correctIndex: 0,
        timeLimit: 15,
        points: 1000,
        explanation: 'The Germano-Douala Treaty was officially signed on July 12, 1884, establishing the German Protectorate of Kamerun.',
        aiHostComment: 'A foundational milestone in Cameroonian colonial history and GCE syllabus.'
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
        aiHostComment: 'Standard civics and concours question on Cameroonian territorial administration.'
      },
      {
        id: 'cm-h-4',
        question: 'Which prominent nationalist leader was the first Secretary-General of the Union des Populations du Cameroun (UPC), assassinated in the Sanaga-Maritime in 1958?',
        options: ['Ruben Um Nyobè', 'Félix-Roland Moumié', 'Ernest Ouandié', 'Ahmadou Ahidjo'],
        correctIndex: 0,
        timeLimit: 15,
        points: 1000,
        explanation: 'Ruben Um Nyobè (Mpodol) led the UPC campaign for independence and reunification before he was killed by French forces on September 13, 1958.',
        aiHostComment: 'A revered figure in the Cameroonian independence struggle.'
      },
      {
        id: 'cm-h-5',
        question: 'What is the highest mountain peak in Cameroon and West/Central Africa, standing at an elevation of 4,095 meters?',
        options: ['Mount Cameroon (Mount Fako)', 'Mount Manengouba', 'Mount Oku', 'Mount Kupe'],
        correctIndex: 0,
        timeLimit: 15,
        points: 1000,
        explanation: 'Mount Cameroon (Fako), located in the South West Region, is an active volcano and the highest point in Cameroon at 4,095 meters.',
        aiHostComment: 'Home to the famous annual Mount Cameroon Race of Hope.'
      }
    ]
  },
  cameroon_science: {
    id: 'sample-cm-math-1',
    title: 'Cameroon GCE O/L & A/L Mathematics & Physical Sciences',
    description: 'Rigorous calculation and conceptual questions aligned with the Cameroon GCE Board syllabus.',
    category: 'Mathematics & Science',
    difficulty: 'medium',
    topic: 'Cameroon GCE Mathematics',
    createdAt: new Date().toISOString(),
    questions: [
      {
        id: 'cm-m-1',
        question: 'Solve for $x$ in the quadratic equation $2x^2 - 7x + 3 = 0$.',
        options: ['$x = 3$ or $x = \\frac{1}{2}$', '$x = -3$ or $x = -\\frac{1}{2}$', '$x = 2$ or $x = \\frac{3}{2}$', '$x = 1$ or $x = 6$'],
        correctIndex: 0,
        timeLimit: 20,
        points: 1000,
        explanation: 'Factoring: $(2x - 1)(x - 3) = 0 \\implies x = 3$ or $x = \\frac{1}{2}$.',
        aiHostComment: 'Classic Cameroon GCE Ordinary Level Paper 1 algebra question.'
      },
      {
        id: 'cm-m-2',
        question: 'In Cameroon, the currency is the Central African CFA Franc (XAF). If an item costs 15,000 XAF with a 19.25% VAT, what is the total amount payable?',
        options: ['17,887.5 XAF', '16,500 XAF', '18,200 XAF', '15,925 XAF'],
        correctIndex: 0,
        timeLimit: 20,
        points: 1000,
        explanation: 'Total = $15,000 \\times (1 + 0.1925) = 15,000 \\times 1.1925 = 17,887.5$ XAF.',
        aiHostComment: 'Commercial Arithmetic in line with Cameroonian tax and economics standards.'
      },
      {
        id: 'cm-m-3',
        question: 'Find the derivative $\\frac{dy}{dx}$ if $y = 3x^4 - 5x^2 + 8x - 12$.',
        options: ['$12x^3 - 10x + 8$', '$12x^3 - 5x + 8$', '$3x^3 - 10x$', '$7x^3 - 10x + 8$'],
        correctIndex: 0,
        timeLimit: 15,
        points: 1000,
        explanation: 'Using the power rule $\\frac{d}{dx}(x^n) = n x^{n-1}$, we obtain $12x^3 - 10x + 8$.',
        aiHostComment: 'Standard GCE Advanced Level Pure Mathematics calculus problem.'
      },
      {
        id: 'cm-m-4',
        question: 'What is the SI unit of electric potential difference in physical measurement?',
        options: ['Volt (V)', 'Ampere (A)', 'Ohm ($\\Omega$)', 'Joule (J)'],
        correctIndex: 0,
        timeLimit: 15,
        points: 1000,
        explanation: 'Electric potential difference (voltage) is measured in Volts (V), defined as Joules per Coulomb.',
        aiHostComment: 'Core GCE Physics fundamental concepts.'
      },
      {
        id: 'cm-m-5',
        question: 'Which of the following organic compounds is the primary constituent of natural gas extracted at the Logbaba gas field in Douala, Cameroon?',
        options: ['Methane ($CH_4$)', 'Ethane ($C_2H_6$)', 'Propane ($C_3H_8$)', 'Butane ($C_4H_{10}$)'],
        correctIndex: 0,
        timeLimit: 15,
        points: 1000,
        explanation: 'Methane ($CH_4$) comprises over 90% of natural gas reserves processed for industrial energy in Douala.',
        aiHostComment: 'Cameroon industrial chemistry application.'
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
    if (topic.toLowerCase().includes('hist') || topic.toLowerCase().includes('cameroon') || topic.toLowerCase().includes('concours') || topic.toLowerCase().includes('civic')) {
      return { ...SAMPLE_QUIZZES.cameroon_history, topic };
    }
    if (topic.toLowerCase().includes('math') || topic.toLowerCase().includes('physic') || topic.toLowerCase().includes('sci') || topic.toLowerCase().includes('gce')) {
      return { ...SAMPLE_QUIZZES.cameroon_science, topic };
    }
    return generateSmartMockQuiz(topic, count, difficulty);
  }

  // Determine provider: GroqCloud (gsk_...) vs xAI (xai-...)
  const isGroq = apiKey.startsWith('gsk_');
  const endpoint = isGroq
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.x.ai/v1/chat/completions';
  const modelName = isGroq ? 'openai/gpt-oss-120b' : 'grok-2-latest';

  console.log(`[Kinetic AI] Calling ${isGroq ? 'Groq' : 'xAI'} API (${modelName}) for topic: "${topic}" (Cameroon syllabus & academic style)...`);

  const systemPrompt = `You are an elite educational examination author and senior curriculum inspector specializing in Cameroonian academic standards (Cameroon GCE Board Ordinary Level and Advanced Level, National Competitive Concours such as ENAM, ENS, Polytech, FHS/CUSS, ENSET, IRIC, and General Knowledge / Culture Générale).

YOUR TASK:
Generate a structured JSON quiz of EXACTLY ${count} questions on the requested topic, adhering to the authentic Cameroonian question-setting pedagogy and style.

CRITICAL CAMEROONIAN CURRICULUM & QUESTION-SETTING RULES:
1. PEDAGOGICAL ACCURACY:
   - Formulate clear, syllabus-grounded, unambiguous multiple-choice questions (Paper 1 style).
   - Questions must be direct and factually authoritative (e.g. "Which of the following is...", "What was the immediate consequence of...", "Calculate the value of...", "In which year did...").
   - If the topic relates to History, Civics, Geography, Law, Economics, General Knowledge, or Sports:
     * Ground references in authentic Cameroonian institutions (The Constitution of Cameroon, 10 Regions & Divisional capitals, Presidency, Prime Ministry, National Assembly, Senate, Constitutional Council).
     * Cameroon History (German Kamerun 1884 Treaty with Kings Bell and Akwa, WWI partition 1916, League of Nations Mandates & UN Trusteeships, UPC nationalist leaders Ruben Um Nyobe, Felix Moumie, Ernest Ouandie, Independence Jan 1 1960, Feb 1961 Plebiscite, July 1961 Foumban Conference, Oct 1 1961 Reunification, May 20 1972 Unitary State, 1984 Republic of Cameroon, Presidents Ahmadou Ahidjo and Paul Biya).
     * Geography & Economy (Mount Fako / Mount Cameroon 4095m, Sanaga River, Lake Nyos, Waza Park, CDC, Pamol, Socapalm, Sodecoton, Alucam, SONARA, Central African CFA Franc XAF, BEAC, CEMAC).
     * Culture & Sports (Indomitable Lions, 5 AFCON championships, Samuel Eto'o, Roger Milla, Rigobert Song, Makossa, Bikutsi, 250+ ethnic groups, Official Bilingualism: English & French).
   - If the topic is STEM (Mathematics, Physics, Chemistry, Biology, Computer Science):
     * Follow Cameroon GCE Ordinary Level (Form 1–5) or Advanced Level (Lower Sixth–Upper Sixth) rigor.
     * Use standard SI units and Cameroonian currency (XAF / FCFA) where applicable.

2. MATHEMATICS & SCIENTIFIC FORMULAS:
   - For ANY mathematical, physical, or chemical equations, powers, fractions, roots, or symbols, ALWAYS format with standard LaTeX enclosed in single dollar signs $...$ (e.g. "$2x^2 - 7x + 3 = 0$", "$\\frac{dy}{dx} = 12x^3 - 10x$", "$\\int_0^2 3x^2 dx$", "$E = mc^2$", "$CH_4$", "$H_2SO_4$").

3. DISTRACTOR & OPTION INTEGRITY:
   - Provide EXACTLY 4 distinct, plausible options (A, B, C, D) per question.
   - Distractors must represent plausible student misconceptions, related dates, or accurate alternative terms.
   - Distribute the correct answers evenly across index 0 to 3.
   - Do NOT include option prefixes like "A)", "B.", or "Option 1" inside the option text strings.

4. EXACT QUESTION COUNT:
   - You MUST generate EXACTLY ${count} questions in the "questions" array. Do not truncate or stop early.

5. FORMAT & TONE:
   - Strictly return a valid JSON object matching the TypeScript interface below without markdown quotes.
   - Tone: ${tone}.
   - Do NOT use unicode emojis in questions or options.

JSON SCHEMA:
{
  "title": "Precise, authoritative title (e.g. Cameroon GCE Advanced Level Pure Mathematics)",
  "description": "1-sentence synopsis referencing the curriculum context",
  "category": "Curriculum Domain (e.g. Cameroon History, GCE Mathematics, Physical Sciences, General Knowledge)",
  "difficulty": "${difficulty}",
  "questions": [
    {
      "question": "Clear, syllabus-accurate question stem (use $...$ for formulas)",
      "options": ["Plausible Option A", "Plausible Option B", "Plausible Option C", "Plausible Option D"],
      "correctIndex": 0, // 0, 1, 2, or 3
      "timeLimit": 15,
      "points": 1000,
      "explanation": "Clear 1-2 sentence step-by-step or historical proof",
      "aiHostComment": "Analytical insight grounded in the subject matter"
    }
  ]
}`;

  const userPrompt = `Generate a ${difficulty}-level Cameroon examination quiz on the topic: "${topic}".
Total Questions: EXACTLY ${count} questions.
Ensure all questions follow authentic Cameroonian GCE / Concours style and formatting.`;

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

    console.log(`[Kinetic AI] Successfully generated ${formattedQuestions.length} Cameroon-style questions from ${isGroq ? 'Groq' : 'Grok'} AI!`);

    return {
      id: quizId,
      title: parsed.title || `${topic} Examination Arena`,
      description: parsed.description || `Cameroon curriculum & examination assessment on "${topic}"`,
      category: parsed.category || 'Cameroon Academic & Concours',
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
  const isHistory = topic.toLowerCase().includes('hist') || topic.toLowerCase().includes('cameroon') || topic.toLowerCase().includes('civic') || topic.toLowerCase().includes('concours');
  const isSTEM = topic.toLowerCase().includes('math') || topic.toLowerCase().includes('physic') || topic.toLowerCase().includes('chem') || topic.toLowerCase().includes('sci');

  const cmHistoryPool = [
    {
      q: 'On what date did East Cameroon (former French Cameroun) gain national independence?',
      opts: ['January 1, 1960', 'October 1, 1961', 'May 20, 1972', 'July 12, 1884'],
      correct: 0,
      exp: 'The Republic of Cameroun gained its independence on January 1, 1960, under President Ahmadou Ahidjo.',
      comment: 'Key independence date in the Cameroon GCE History curriculum.'
    },
    {
      q: 'Which treaty ended German colonial rule over Kamerun following World War I?',
      opts: ['Treaty of Versailles (1919)', 'Treaty of Berlin (1885)', 'Foumban Accord (1961)', 'Yaounde Convention (1963)'],
      correct: 0,
      exp: 'The Treaty of Versailles in 1919 officially stripped Germany of Kamerun, partitioning it between Britain and France as League of Nations mandates.',
      comment: 'Core milestone in the partition and mandate era of Cameroon.'
    },
    {
      q: 'What significant national event occurred on May 20, 1972, celebrated as Cameroon\'s National Day?',
      opts: ['Referendum establishing the Unitary State', 'Signing of the Germano-Douala Treaty', 'Reunification of the Two Cameroons', 'Promulgation of the 1996 Constitution'],
      correct: 0,
      exp: 'The May 20, 1972 referendum transformed the Federal Republic of Cameroon into the United Republic of Cameroon.',
      comment: 'Basis for Cameroon\'s National Day (Fête Nationale du 20 Mai).'
    },
    {
      q: 'What is the administrative headquarters of the South West Region of Cameroon?',
      opts: ['Buea', 'Limbe', 'Kumba', 'Mamfe'],
      correct: 0,
      exp: 'Buea is the regional capital of the South West Region and former capital of German Kamerun and British Southern Cameroons.',
      comment: 'Standard administrative geography of Cameroon.'
    },
    {
      q: 'Which national agro-industrial company is the largest public employer in Cameroon, operating rubber, palm oil, and tea plantations in the South West and Littoral regions?',
      opts: ['Cameroon Development Corporation (CDC)', 'PAMOL Plantations PLC', 'SOCAPALM', 'SODECOTON'],
      correct: 0,
      exp: 'The Cameroon Development Corporation (CDC), created in 1947, is the second largest employer in Cameroon after the State.',
      comment: 'Key economic enterprise in the Cameroon GCE Economics and Geography syllabus.'
    },
    {
      q: 'How many times has the Cameroon Men\'s National Football Team (Indomitable Lions) won the Africa Cup of Nations (AFCON)?',
      opts: ['5 Times (1984, 1988, 2000, 2002, 2017)', '3 Times (1990, 2000, 2010)', '4 Times (1984, 1988, 1990, 2002)', '6 Times (1982, 1984, 1988, 2000, 2002, 2017)'],
      correct: 0,
      exp: 'Cameroon won the AFCON trophy in 1984 (Ivory Coast), 1988 (Morocco), 2000 (Nigeria/Ghana), 2002 (Mali), and 2017 (Gabon).',
      comment: 'Iconic sports heritage of the Indomitable Lions.'
    },
    {
      q: 'Which major Cameroonian river is the longest entirely within the national territory and supplies the Song Loulou and Edéa hydroelectric power stations?',
      opts: ['Sanaga River', 'Benue River', 'Nyong River', 'Wouri River'],
      correct: 0,
      exp: 'The Sanaga River (918 km) is Cameroon\'s longest river, providing the majority of the nation\'s hydroelectric energy.',
      comment: 'Standard Cameroon GCE Geography Paper 1 question.'
    },
    {
      q: 'In the Parliament of Cameroon, how many members make up the National Assembly (Deputies)?',
      opts: ['180 Members', '100 Members', '120 Members', '200 Members'],
      correct: 0,
      exp: 'The National Assembly of Cameroon comprises 180 members elected for a 5-year term.',
      comment: 'Fundamental civics and constitutional law in Cameroon.'
    }
  ];

  const cmSTEMPool = [
    {
      q: 'Evaluate the derivative $\\frac{d}{dx}\\left[\\ln(3x^2 + 1)\\right]$ using the chain rule.',
      opts: ['$\\frac{6x}{3x^2 + 1}$', '$\\frac{3x}{3x^2 + 1}$', '$\\frac{1}{3x^2 + 1}$', '$\\frac{6x^2}{3x^2 + 1}$'],
      correct: 0,
      exp: 'By the chain rule: $\\frac{d}{dx}[\\ln(u)] = \\frac{u\'}{u} = \\frac{6x}{3x^2 + 1}$.',
      comment: 'Classic GCE Advanced Level Pure Mathematics calculus problem.'
    },
    {
      q: 'A force of $50\\text{ N}$ acts on an object of mass $5\\text{ kg}$ on a smooth horizontal surface. What is its acceleration?',
      opts: ['$10\\text{ m/s}^2$', '$250\\text{ m/s}^2$', '$0.1\\text{ m/s}^2$', '$45\\text{ m/s}^2$'],
      correct: 0,
      exp: 'Using Newton\'s Second Law: $F = ma \\implies a = \\frac{F}{m} = \\frac{50}{5} = 10\\text{ m/s}^2$.',
      comment: 'Core GCE Ordinary & Advanced Level Physics mechanics principle.'
    },
    {
      q: 'What is the empirical formula of a hydrocarbon containing $80\\%$ Carbon and $20\\%$ Hydrogen by mass? ($C = 12, H = 1$)',
      opts: ['$CH_3$', '$CH_2$', '$CH_4$', '$C_2H_6$'],
      correct: 0,
      exp: 'Moles of $C = \\frac{80}{12} = 6.67$, Moles of $H = \\frac{20}{1} = 20$. Ratio $= \\frac{20}{6.67} = 3 \\implies CH_3$.',
      comment: 'Fundamental GCE Chemistry stoichiometry calculation.'
    },
    {
      q: 'In binary computer arithmetic, what is the decimal equivalent of the 8-bit binary number $(10010110)_2$?',
      opts: ['150', '142', '166', '134'],
      correct: 0,
      exp: '$128 + 16 + 4 + 2 = 150$.',
      comment: 'Cameroon GCE Computer Science Paper 1 fundamental arithmetic.'
    },
    {
      q: 'What is the standard acceleration due to gravity ($g$) near the Earth\'s surface in Cameroon GCE Physics calculations?',
      opts: ['$9.8\\text{ m/s}^2$ (or $10\\text{ m/s}^2$)', '$8.9\\text{ m/s}^2$', '$100\\text{ m/s}^2$', '$4.9\\text{ m/s}^2$'],
      correct: 0,
      exp: 'Standard gravitational acceleration is $9.8\\text{ m/s}^2$ (or $10\\text{ m/s}^2$ for approximate O/L calculations).',
      comment: 'Standard constant in Cameroon physics examinations.'
    }
  ];

  const activePool = isSTEM ? cmSTEMPool : (isHistory ? cmHistoryPool : [...cmHistoryPool, ...cmSTEMPool]);
  const questions: QuizQuestion[] = [];

  const targetCount = Math.max(1, Math.min(count, 50));
  for (let i = 0; i < targetCount; i++) {
    const item = activePool[i % activePool.length];
    questions.push({
      id: `cm-smart-q-${i + 1}-${Date.now()}`,
      question: item.q,
      options: item.opts,
      correctIndex: item.correct,
      timeLimit: 15,
      points: 1000,
      explanation: item.exp,
      aiHostComment: item.comment,
      category: topic
    });
  }

  return {
    id: `cm-smart-quiz-${Date.now()}`,
    title: `${topic} Examination Arena`,
    description: `A rigorous Cameroon curriculum and Concours assessment with ${targetCount} verified questions.`,
    category: isSTEM ? 'Cameroon GCE Sciences' : 'Cameroon History & Concours',
    difficulty,
    topic,
    questions,
    createdAt: new Date().toISOString()
  };
}

