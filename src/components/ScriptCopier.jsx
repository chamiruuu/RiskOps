import { useState } from 'react';

export default function ScriptCopier({ ticket, currentUser }) {
  const [copied, setCopied] = useState(false);

  const generateScript = () => {
    const isBlockedProvider = ['PG Soft', 'PA Casino'].includes(ticket.provider);
    
    // We assume current user name is passed down or fetched from context
    const userName = currentUser?.email?.split('@')[0] || "RiskOps";

    if (isBlockedProvider) {
      return `Hi Team, as we check there is no profit from the provider ${ticket.provider}, for the mentioned time period. As for the query guidelines of the provider we cannot proceed further since there is no Profit. Sorry for the inconvenience. Thank You - ${userName}`;
    } else {
      return `Hello team, this is ${userName}. As we confirmed the member has no profit from the provider during this period. Do you still need to check member bet normal or not?`;
    }
  };

  const handleCopy = async () => {
    const text = generateScript();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="mt-2">
       <div className="bg-gray-50 p-2 text-xs font-mono text-gray-600 rounded border mb-1">
          {generateScript()}
       </div>
       <button 
         onClick={handleCopy}
         className={`text-xs px-2 py-1 rounded ${copied ? 'bg-green-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
       >
         {copied ? "Copied!" : "Copy Script"}
       </button>
    </div>
  );
}