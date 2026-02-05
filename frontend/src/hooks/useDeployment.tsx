import { useState } from "react";
import { Node, Edge, useReactFlow } from "reactflow";

export const useDeployment = () => {
  const [isDeploying, setIsDeploying] = useState(false);
  const { getNodes, getEdges } = useReactFlow();

  const deploy = async (workflowName: string, globalSettings: any) => {
    setIsDeploying(true);
    const nodes = getNodes();
    const edges = getEdges();

    try {
      // 1. FIND TRIGGER
      // We look for nodes that act as starters.
      const triggerNode = nodes.find((n) =>
        ["webhook", "timer", "sheets", "read_rss"].includes(n.data.type),
      );

      if (!triggerNode) {
        throw new Error(
          "No Trigger Node found. Please add a Webhook, Timer, or Sheet trigger to start the flow.",
        );
      }

      // 2. ROBUSTNESS CHECK: Branching
      // Our current Phase 1 backend is a linear runner. We must ensure no node has > 1 outgoing edge.
      const nodesWithMultipleOutputs = nodes.filter((n) => {
        const outgoing = edges.filter((e) => e.source === n.id);
        return outgoing.length > 1;
      });

      if (nodesWithMultipleOutputs.length > 0) {
        throw new Error(
          "Complex Branching (If/Else) is not supported in Phase 1. Please ensure a linear chain.",
        );
      }

      // 3. LINEARIZE GRAPH (Walk the path)
      const sortedActions = [];
      let currentNode: Node | undefined = triggerNode;
      const visited = new Set();

      // Safety limit to prevent infinite loops if graph has cycles
      let depth = 0;
      const MAX_DEPTH = 50;

      while (currentNode && depth < MAX_DEPTH) {
        if (visited.has(currentNode.id)) break; // Loop detected
        visited.add(currentNode.id);

        // We do NOT add the Trigger node itself to the "actions" array if it serves purely as a configuration starter.
        // - 'webhook', 'sheets', 'timer': Pure triggers (Config goes to trigger object).
        // - 'read_rss': Hybrid (It triggers, but also performs an action like fetching data).
        const isPureTrigger = ["webhook", "sheets", "timer"].includes(
          currentNode.data.type,
        );

        if (!isPureTrigger) {
          sortedActions.push({
            type: currentNode.data.type,
            // We pass the entire config object as inputs
            inputs: { ...currentNode.data.config },
          });
        }

        // Find the next node connected to this one
        const outgoingEdge = edges.find((e) => e.source === currentNode?.id);

        if (!outgoingEdge) {
          currentNode = undefined; // End of chain
        } else {
          currentNode = nodes.find((n) => n.id === outgoingEdge.target);
        }

        depth++;
      }

      if (depth >= MAX_DEPTH) {
        console.warn("Workflow depth limit reached. Possible infinite loop.");
      }

      // 4. CONSTRUCT PAYLOAD
      // This matches exactly what src/api/server.ts expects
      const payload = {
        config: {
          // Send ID if present, otherwise null. Backend handles the check.
          spreadsheetId: globalSettings.spreadsheetId || null,
          trigger: {
            type: triggerNode.data.type, // e.g. 'sheets' or 'webhook'
            ...triggerNode.data.config, // e.g. { colIndex: 5, value: 'Pending' }
          },
          actions: sortedActions,
        },
        // Optional: Context for manual testing/webhooks
        context: {
          TEST_USER: "Frontend_User",
          TEST_SOURCE: "Frontend Deploy",
        },
      };

      console.log(
        "🚀 Sending Deployment Payload:",
        JSON.stringify(payload, null, 2),
      );

      // 5. SEND TO BACKEND (Targeting Port 3001)
      const BACKEND_URL = "http://localhost:3001/trigger-workflow";

      const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Handle non-JSON responses (like 404 HTML pages or network errors) safely
      const contentType = response.headers.get("content-type");
      let result;

      if (contentType && contentType.includes("application/json")) {
        result = await response.json();
      } else {
        // If server returns text/html error page
        const text = await response.text();
        throw new Error(`Server Error (${response.status}): ${text}`);
      }

      if (!response.ok) {
        throw new Error(result.error || `Server returned ${response.status}`);
      }

      return { success: true, data: result };
    } catch (error: any) {
      console.error("Deployment Error:", error);
      return { success: false, error: error.message };
    } finally {
      setIsDeploying(false);
    }
  };

  return { deploy, isDeploying };
};
