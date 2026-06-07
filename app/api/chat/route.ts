import Anthropic from '@anthropic-ai/sdk';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { SYSTEM_PROMPT } from '@/lib/chatbot-prompt';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const DAILY_LIMIT = 15;

export async function POST(req: Request) {
  try {
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages, sessionId } = await req.json();

    if (!sessionId || !Array.isArray(messages)) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const today = new Date().toISOString().split('T')[0];

    const { data: usage } = await supabase
      .from('chat_usage')
      .select('*')
      .eq('session_id', sessionId)
      .eq('date', today)
      .single();

    const currentCount = Number(usage?.count ?? 0);

    if (currentCount >= DAILY_LIMIT) {
      return Response.json({ reply: null, limitReached: true });
    }

    await supabase.from('chat_usage').upsert(
      { session_id: sessionId, date: today, count: currentCount + 1 },
      { onConflict: 'session_id,date' }
    );

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: messages.slice(-6),
    });

    const reply =
      response.content[0]?.type === 'text' ? response.content[0].text : '';

    return Response.json({ reply, limitReached: false });
  } catch (err) {
    console.error('[/api/chat]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
