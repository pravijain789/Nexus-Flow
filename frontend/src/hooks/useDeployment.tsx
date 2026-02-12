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
      // 1. Calculate In-Degree (To identify Merge Nodes)
      const inDegree = new Map<string, number>();
      edges.forEach((e) => {
        inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
      });

      const isMergeNode = (id: string) => (inDegree.get(id) || 0) > 1;

      // 2. Find Trigger
      const triggerNode = nodes.find((n) =>
        ["webhook", "timer", "sheets", "read_rss"].includes(n.data.type),
      );
      if (!triggerNode) throw new Error("No Trigger Node found.");

      // --- RECURSIVE BUILDER ---
      const buildSegment = (
        startId: string,
        visited: Set<string>,
        stopAtMerge: boolean, // Flag: Should we stop if we hit a merge node?
      ): { actions: any[]; stoppedAt: string | null } => {
        const actions: any[] = [];
        let currentId: string | undefined = startId;

        while (currentId) {
          if (visited.has(currentId)) break;

          // A. MERGE STOP CHECK
          // If this node is a Merge Point AND we were told to stop at merges (i.e., we are inside a branch),
          // we stop immediately. We do NOT add this node to the list.
          if (stopAtMerge && isMergeNode(currentId)) {
            return { actions, stoppedAt: currentId };
          }

          visited.add(currentId);
          const node = nodes.find((n) => n.id === currentId);
          if (!node) break;

          // B. ADD NODE (If not trigger)
          if (!["webhook", "sheets", "timer"].includes(node.data.type)) {
            actions.push({
              id: node.id,
              type: node.data.type,
              inputs: { ...node.data.config },
            });
          }

          // C. FIND OUTGOING
          // Special handling for Condition Nodes vs Normal Nodes
          if (node.data.type === "condition") {
            const trueEdges = edges.filter(
              (e) => e.source === node.id && e.sourceHandle === "true",
            );
            const falseEdges = edges.filter(
              (e) => e.source === node.id && e.sourceHandle === "false",
            );

            // We build sub-flows for True/False paths
            // standard "stopAtMerge: false" because condition branches usually don't merge back simply
            const trueFlow = buildFlowFromEdges(trueEdges, new Set(visited));
            const falseFlow = buildFlowFromEdges(falseEdges, new Set(visited));

            // We replace the last action (the condition node stub) with the full condition block
            actions.pop();
            actions.push({
              id: node.id,
              type: "condition",
              inputs: { ...node.data.config },
              trueRoutes: trueFlow.actions,
              falseRoutes: falseFlow.actions,
            });

            // Conditions are terminal for this linear segment builder usually
            return { actions, stoppedAt: null };
          }

          // Standard Nodes
          const outgoing = edges.filter((e) => e.source === currentId);

          if (outgoing.length === 0) {
            currentId = undefined; // End
          } else if (outgoing.length === 1) {
            currentId = outgoing[0].target; // Linear continue
          } else {
            // D. PARALLEL SPLIT
            // We have >1 outgoing edge. This is a fork.

            // 1. Build all branches
            // CRITICAL: We pass stopAtMerge=true so they stop when they hit the shared merge node
            const branches = outgoing.map((edge) =>
              buildSegment(edge.target, new Set(visited), true),
            );

            actions.push({
              type: "parallel",
              branches: branches.map((b) => b.actions),
            });

            // 2. Check for Convergence
            const stopPoints = branches
              .map((b) => b.stoppedAt)
              .filter((id) => id !== null);
            const uniqueStops = [...new Set(stopPoints)];

            if (stopPoints.length > 0 && uniqueStops.length === 1) {
              // E. RESUME MAIN CHAIN
              // All branches stopped at the same node.
              // We continue the main loop from that node.
              currentId = uniqueStops[0];
            } else {
              currentId = undefined; // Diverged
            }
          }
        }
        return { actions, stoppedAt: null };
      };

      // Helper wrapper for the fan-out logic
      const buildFlowFromEdges = (
        outgoingEdges: Edge[],
        visited: Set<string>,
      ) => {
        if (outgoingEdges.length === 0) return { actions: [], stoppedAt: null };

        // If multiple edges start immediately (rare but possible condition fork)
        if (outgoingEdges.length > 1) {
          // Treat as parallel start
          const branches = outgoingEdges.map((edge) =>
            buildSegment(edge.target, new Set(visited), true),
          );
          // Check merge
          const stopPoints = branches
            .map((b) => b.stoppedAt)
            .filter((id) => id !== null);
          const uniqueStops = [...new Set(stopPoints)];

          const actions = [
            { type: "parallel", branches: branches.map((b) => b.actions) },
          ];

          if (uniqueStops.length === 1) {
            const continuation = buildSegment(
              uniqueStops[0],
              new Set(visited),
              false,
            );
            return {
              actions: [...actions, ...continuation.actions],
              stoppedAt: null,
            };
          }
          return { actions, stoppedAt: null };
        }

        return buildSegment(outgoingEdges[0].target, visited, false);
      };

      // 4. Build Payload
      // We start with stopAtMerge=false because the main chain shouldn't stop arbitrarily
      const rootResult = buildSegment(triggerNode.id, new Set(), false);

      const payload = {
        config: {
          spreadsheetId: globalSettings.spreadsheetId || null,
          columnMapping: globalSettings.columnMapping || {},
          trigger: { type: triggerNode.data.type, ...triggerNode.data.config },
          actions: rootResult.actions,
        },
        context: { TEST_USER: "Frontend_Deploy" },
      };

      console.log("🚀 Payload:", JSON.stringify(payload, null, 2));

      const response = await fetch("http://localhost:3001/trigger-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Server Error");

      return { success: true, data: result };
    } catch (error: any) {
      console.error(error);
      return { success: false, error: error.message };
    } finally {
      setIsDeploying(false);
    }
  };

  return { deploy, isDeploying };
};
