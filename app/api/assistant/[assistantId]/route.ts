import { auth, currentUser } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";

export async function PATCH(
  req: Request,
  { params }: { params: { assistantId: string } }
) {
  try {
    const body = await req.json();
    const user = await currentUser();
    const { src, name, description, instructions, seed, categoryId } = body;

    if (!params.assistantId) {
      return new NextResponse("Assistant ID is required", { status: 400 });
    }

    if (!user || !user.id || !user.firstName) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (
      !src ||
      !name ||
      !description ||
      !instructions ||
      !seed ||
      !categoryId
    ) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // TODO(jiyoung): check for subscription.

    const assistant = await prismadb.assistant.update({
      where: {
        id: params.assistantId,
        userId: user.id,
      },
      data: {
        categoryId,
        userId: user.id,
        userName: user.firstName,
        src,
        name,
        description,
        instructions,
        seed,
      },
    });

    return NextResponse.json(assistant);
  } catch (error) {
    console.log("[ASSISTANT_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { assistantId: string } }
) {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const assistant = await prismadb.assistant.delete({
      where: {
        userId,
        id: params.assistantId,
      },
    });

    return NextResponse.json(assistant);
  } catch (error) {
    console.log("[ASSISTANT_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
