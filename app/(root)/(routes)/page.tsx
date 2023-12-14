import { Assistants } from "@/components/assistants";
import { SearchInput } from "@/components/search-input";
import prismadb from "@/lib/prismadb";

interface RootPageProps {
  searchParams: {
    categoryId: string;
    name: string;
  };
}

const RootPage = async ({ searchParams }: RootPageProps) => {
  const data = await prismadb.assistant.findMany({
    where: {
      categoryId: searchParams.categoryId,
      name: {
        search: searchParams.name,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      _count: {
        select: {
          messages: true
        }
      }
    }
  });

  return (
    <div className="h-full p-4 space-y-2">
      <SearchInput />
      <Assistants data={data} />
    </div>
  );
};

export default RootPage;
