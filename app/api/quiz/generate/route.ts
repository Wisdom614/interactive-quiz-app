import { NextRequest, NextResponse } from 'next/server';
import { generateQuizWithGrok, GenerateQuizParams } from '@/lib/ai/grok';

export async function POST(req: NextRequest) {
  try {
    const body: GenerateQuizParams = await req.json();

    if (!body.topic || body.topic.trim().length === 0) {
      return NextResponse.json(
        { error: 'A quiz topic or prompt is required' },
        { status: 400 }
      );
    }

    const quiz = await generateQuizWithGrok({
      topic: body.topic,
      questionCount: body.questionCount || 5,
      difficulty: body.difficulty || 'medium',
      tone: body.tone || 'humorous'
    });

    return NextResponse.json({ success: true, quiz });
  } catch (error) {
    console.error('Failed to generate quiz:', error);
    return NextResponse.json(
      { error: 'An error occurred while generating the quiz' },
      { status: 500 }
    );
  }
}
