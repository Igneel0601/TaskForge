'use server';

import Board from "@/components/Board";
import BoardSummary from "@/components/Summary";
import { liveblocksClient } from "@/lib/liveblocksClient";
import { getUserEmail } from "@/lib/userClient";

type PageProps = {
  params: {
    boardId: string;
  };
};

export default async function BoardPage(props: PageProps) {
  const boardId = props.params.boardId;
  const userEmail = await getUserEmail();
  const boardInfo = await liveblocksClient.getRoom(boardId);
  const userAccess = boardInfo.usersAccesses?.[userEmail];
  const hasAccess = userAccess && [...userAccess].includes('room:write');
  if (!hasAccess) {
    return (
      <div>Access denied</div>
    );
  }
  return (
    <div>
      <Board
        name={boardInfo.metadata.boardName.toString()}
        id={boardId} />
      <div className="fixed inset-x-0 bottom-0 z-50 mb-4 mx-8">
          <BoardSummary />
      </div>

    </div>
  );
}