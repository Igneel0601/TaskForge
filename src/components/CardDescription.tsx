import {useRoom, useStorage} from "@/app/liveblocks.config";
import DescriptionEditor from "@/components/DescriptionEditor";
import LiveblocksProvider from "@liveblocks/yjs";
import {useParams} from "next/navigation";
import {useEffect, useState} from "react";
import {Doc} from "yjs";

export default function CardDescription() {
  const {cardId} = useParams();
  const room = useRoom();

  const [doc, setDoc] = useState<Doc|null>(null);
  const [provider, setProvider] = useState<LiveblocksProvider<any, any, any, any>|null>(null);

  // ✅ Fetch card data from Liveblocks storage
  const card = useStorage((root) => {
    const cards = root.cards;
    return cards?.find((c) => c.id === cardId.toString());
  });

  // ✅ Fetch columns data (optional, for better AI context)
  const columns = useStorage((root) => root.columns);
  
  // ✅ Fetch all cards (optional, for AI context)
  const allCards = useStorage((root) => root.cards);

  useEffect(() => {
    const yDoc = new Doc();
    const yProvider = new LiveblocksProvider(room as any, yDoc);

    setDoc(yDoc);
    setProvider(yProvider);

    return () => {
      yDoc.destroy();
      yProvider.destroy();
    };

  }, [room]);

  if (!doc || !provider) {
    return null;
  }

  // ✅ Show loading while card data is being fetched
  if (!card) {
    return <div>Loading card...</div>;
  }

  return (
    <div>
      <DescriptionEditor
        doc={doc}
        provider={provider}
        cardId={cardId.toString()}
        cardName={card.name}
        columns={columns ?? undefined}
        cards={allCards ?? undefined}
      />
    </div>
  );
}