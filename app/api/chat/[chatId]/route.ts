import OpenAI from "openai";
import { OpenAIStream, StreamingTextResponse } from "ai";
import { auth, currentUser } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import { MemoryManager } from "@/lib/memory";
import { rateLimit } from "@/lib/rate-limit";
import prismadb from "@/lib/prismadb";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const { prompt } = await request.json();
    const user = await currentUser();

    if (!user || !user.firstName || !user.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const identifier = request.url + "-" + user.id;
    const { success } = await rateLimit(identifier);

    if (!success) {
      return new NextResponse("Rate limit exceeded", { status: 429 });
    }

    const assistant = await prismadb.assistant.update({
      where: {
        id: params.chatId,
      },
      data: {
        messages: {
          create: {
            content: prompt,
            role: "user",
            userId: user.id,
          },
        },
      },
    });

    if (!assistant) {
      return new NextResponse("Assistant not found", { status: 404 });
    }

    const name = assistant.id;
    const assistant_file_name = name + ".txt";

    const assistantKey = {
      assistantName: name!,
      userId: user.id,
      modelName: "llama2-13b",
    };
    const memoryManager = await MemoryManager.getInstance();

    const records = await memoryManager.readLatestHistory(assistantKey);
    if (records.length === 0) {
      await memoryManager.seedChatHistory(assistant.seed, "\n\n", assistantKey);
    }
    await memoryManager.writeToHistory("User: " + prompt + "\n", assistantKey);

    // Query Pinecone

    const recentChatHistory = await memoryManager.readLatestHistory(
      assistantKey
    );

    // Right now the preamble is included in the similarity search, but that
    // shouldn't be an issue

    const similarDocs = await memoryManager.vectorSearch(
      recentChatHistory,
      assistant_file_name
    );

    let relevantHistory = "";
    if (!!similarDocs && similarDocs.length !== 0) {
      relevantHistory = similarDocs.map((doc) => doc.pageContent).join("\n");
    }

    const resp = await openai.completions.create({
      model: "gpt-3.5-turbo-instruct",
      max_tokens: 2000,
      stream: true,
      prompt: `
      ONLY generate plain sentences without prefix of who is speaking. DO NOT use ${assistant.name}: prefix. 

      ${assistant.instructions}

      Below are relevant details about ${assistant.name}'s past and the conversation you are in.
      ${relevantHistory}


      ${recentChatHistory}\n${assistant.name}:`,
    });

    const stream = OpenAIStream(resp);

    const toString = async (stream: ReadableStream) => {
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        chunks.push(chunk);
      }

      return chunks.join("");
    };

    const response = await toString(stream);
    await memoryManager.writeToHistory("" + response.trim(), assistantKey);
    var Readable = require("stream").Readable;

    let s = new Readable();
    s.push(response);
    s.push(null);
    if (response !== undefined && response.length > 1) {
      await prismadb.assistant.update({
        where: {
          id: params.chatId,
        },
        data: {
          messages: {
            create: {
              content: response.trim(),
              role: "system",
              userId: user.id,
            },
          },
        },
      });
    }

    return new StreamingTextResponse(s);
  } catch (error) {
    console.log("[CHAT_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
