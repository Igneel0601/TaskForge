import {useSelf} from "@/app/liveblocks.config";
import {faBold, faHeading, faItalic, faUnderline} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import LiveblocksProvider from "@liveblocks/yjs";
import {Collaboration} from "@tiptap/extension-collaboration";
import {CollaborationCursor} from "@tiptap/extension-collaboration-cursor";
import {Placeholder} from "@tiptap/extension-placeholder";
import {Underline} from "@tiptap/extension-underline";
import {Doc} from "yjs";
import {EditorContent, useEditor} from '@tiptap/react';
import {useState} from 'react';
import {StarterKit} from '@tiptap/starter-kit';

type EditorProps = {
  doc: Doc;
  provider: LiveblocksProvider<any, any, any, any>;
  cardId: string;
  cardName?: string;
  columns?: readonly any[];  // ✅ Accept readonly arrays
  cards?: readonly any[];    // ✅ Accept readonly arrays
};

export default function DescriptionEditor({doc, provider, cardId, cardName, columns, cards}:EditorProps) {

  const userInfo = useSelf(me => me.info);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false,
      }),
      Placeholder.configure({
        emptyEditorClass: 'is-editor-empty',
        placeholder: 'Task description...',
      }),
      Collaboration.configure({
        document: doc,
        field: cardId,
      }),
      CollaborationCursor.configure({
        provider,
        user: userInfo || undefined,
      }),
      Underline.configure(),
    ],
  });

  return (
    <div>
      <div className="flex gap-1 mb-1 mt-2 editor-buttons">
        <button
          className={editor?.isActive('bold') ? 'active' : ''}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <FontAwesomeIcon icon={faBold}/>
        </button>
        <button
          className={editor?.isActive('italic') ? 'active' : ''}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <FontAwesomeIcon icon={faItalic}/>
        </button>
        <button
          className={editor?.isActive('underline') ? 'active' : ''}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <FontAwesomeIcon icon={faUnderline}/>
        </button>
        <button
          className={editor?.isActive('heading') ? 'active' : ''}
          onClick={() => editor?.chain().focus().toggleHeading({level:2}).run()}
        >
          <FontAwesomeIcon icon={faHeading}/>
        </button>
        <AIButton
          editor={editor}
          cardId={cardId}
          cardName={cardName}  // ✅ PASS IT TO AIButton
          columns={columns}
          cards={cards}
        />
      </div>
      <EditorContent editor={editor} className="min-h-[6rem] p-2 border rounded-md editor-content"/>
      <style jsx global>{`
        .editor-content ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .editor-content ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .editor-content li {
          margin: 0.25rem 0;
        }
        .editor-content h3 {
          font-weight: bold;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
        }
      `}</style>
    </div>
  );
}

function AIButton({editor, cardId, cardName, columns, cards}:{
  editor: any;
  cardId: string;
  cardName?: string;
  columns?: readonly any[];  // ✅ Accept readonly arrays
  cards?: readonly any[];    // ✅ Accept readonly arrays
}) {
  const [loading, setLoading] = useState(false);

  async function handleAI() {
    if (!editor) return;
    const currentHTML = editor.getHTML();
    setLoading(true);
    
    // Clear editor and show loading message
    editor.chain().focus().setContent('<p><em>✨ AI is generating content...</em></p>').run();
    
    try {
      const payload: any = { cardId, content: currentHTML };
      
      // ✅ SEND CARD NAME TO API
      if (cardName) payload.cardName = cardName;
      if (columns) payload.columns = columns;
      if (cards) payload.cards = cards;

      const res = await fetch('/api/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('AI API error');
      const data = await res.json();

      // Build content progressively with delays
      let newContent = '';
      
      // Step 1: Add description
      newContent = data.improved || currentHTML;
      editor.chain().focus().setContent(newContent).run();
      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 2: Add checklist
      if (data.checklist && data.checklist.length > 0) {
        newContent += '<p><strong>Checklist</strong></p><ul>';
        editor.chain().focus().setContent(newContent).run();
        await new Promise(resolve => setTimeout(resolve, 200));
        
        for (const item of data.checklist) {
          newContent += `<li>${item}</li>`;
          editor.chain().focus().setContent(newContent).run();
          await new Promise(resolve => setTimeout(resolve, 150));
        }
        newContent += '</ul>';
        editor.chain().focus().setContent(newContent).run();
      }

      // Step 3: Add test cases
      if (data.tests && data.tests.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
        newContent += '<p><strong>Suggested Test Cases</strong></p><ul>';
        editor.chain().focus().setContent(newContent).run();
        await new Promise(resolve => setTimeout(resolve, 200));
        
        for (const test of data.tests) {
          newContent += `<li>${test}</li>`;
          editor.chain().focus().setContent(newContent).run();
          await new Promise(resolve => setTimeout(resolve, 150));
        }
        newContent += '</ul>';
        editor.chain().focus().setContent(newContent).run();
      }

      // Step 4: Add estimate
      if (data.estimate) {
        await new Promise(resolve => setTimeout(resolve, 200));
        newContent += `<p><strong>Estimated time:</strong> ${data.estimate}</p>`;
        editor.chain().focus().setContent(newContent).run();
      }

    } catch (err:any) {
      console.error(err);
      editor.chain().focus().setContent(currentHTML).run();
      alert('AI Assist failed: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={handleAI} className={loading ? 'opacity-50' : ''} disabled={loading}>
      {loading ? '⏳ Thinking...' : '✨ AI Assist'}
    </button>
  );
}