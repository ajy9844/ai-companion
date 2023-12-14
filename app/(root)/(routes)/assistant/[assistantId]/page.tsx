import prismadb from "@/lib/prismadb";
import { auth, redirectToSignIn } from "@clerk/nextjs";

import { AssistantForm } from "./components/assistant-form";

interface AssistantIdPageProps {
  params: {
    assistantId: string;
  };
}

const AssistantIdPage = async ({ params }: AssistantIdPageProps) => {
  const { userId } = auth();
  // TODO(jiyoung): check subscription.

  if (!userId) {
    return redirectToSignIn();
  }

  const assistant = await prismadb.assistant.findUnique({
    where: {
      id: params.assistantId,
      userId
    },
  });

  const categories = await prismadb.category.findMany();

  return <AssistantForm initialData={assistant} categories={categories} />;
};

export default AssistantIdPage;
