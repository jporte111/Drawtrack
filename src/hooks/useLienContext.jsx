import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// Resolves the client + draw cycle behind a lien release so the form can be pre-filled.
export default function useLienContext({ drawVendorId, clientVendorId }) {
  const { data: drawVendor } = useQuery({
    queryKey: ["drawVendor", drawVendorId],
    queryFn: () => base44.entities.DrawVendor.get(drawVendorId),
    enabled: !!drawVendorId,
  });

  const { data: clientVendor } = useQuery({
    queryKey: ["clientVendor", clientVendorId],
    queryFn: () => base44.entities.ClientVendor.get(clientVendorId),
    enabled: !!clientVendorId,
  });

  const { data: drawCycle } = useQuery({
    queryKey: ["drawCycle", drawVendor?.draw_cycle_id],
    queryFn: () => base44.entities.DrawCycle.get(drawVendor.draw_cycle_id),
    enabled: !!drawVendor?.draw_cycle_id,
  });

  const clientId = drawCycle?.client_id || clientVendor?.client_id;

  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => base44.entities.Client.get(clientId),
    enabled: !!clientId,
  });

  return { client, drawCycle };
}