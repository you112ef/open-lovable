// Cloudflare Pages Function for AI Chat API
// This replaces app/api/ai-chat/route.ts

import { OpenAI } from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';

interface Env {
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  try {
    const { message, model = 'gpt-4' } = await request.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    let response;

    if (model.startsWith('claude')) {
      // Use Anthropic Claude
      const anthropic = new Anthropic({
        apiKey: env.ANTHROPIC_API_KEY,
      });

      const result = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        messages: [{ role: 'user', content: message }],
      });

      response = result.content[0].text;
    } else {
      // Use OpenAI GPT
      const openai = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
      });

      const result = await openai.chat.completions.create({
        model: model,
        messages: [{ role: 'user', content: message }],
        temperature: 0.7,
        max_tokens: 4000,
      });

      response = result.choices[0]?.message?.content || 'No response generated';
    }

    return new Response(
      JSON.stringify({ 
        response,
        model,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    );

  } catch (error) {
    console.error('AI Chat error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process AI request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle CORS preflight requests
export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}