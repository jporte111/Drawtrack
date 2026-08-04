import React, { useState, useRef, useCallback, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, ExternalLink, Pencil, ArrowLeft, ZoomIn, ZoomOut, Maximize, Hand, MousePointer, RefreshCw } from "lucide-react";

export default function Budget() {
  const { clientId } = useParams();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(() => Date.now());
  const [isDragging, setIsDragging] = useState(false);
  const [panMode, setPanMode] = useState(true);
  const scrollRef = useRef(null);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const zoomIn = () => setZoom((z) => Math.min(z + 0.1, 2));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.1, 0.5));
  const resetZoom = () => setZoom(1);

  const handleMouseDown = useCallback((e) => {
    if (!scrollRef.current || zoom === 1 || !panMode) return;
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: scrollRef.current.scrollLeft,
      scrollTop: scrollRef.current.scrollTop,
    };
  }, [zoom]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e) => {
      if (!scrollRef.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      scrollRef.current.scrollLeft = dragStart.current.scrollLeft - dx;
      scrollRef.current.scrollTop = dragStart.current.scrollTop - dy;
    };
    const handleMouseUp = () => setIsDragging(false);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => base44.entities.Client.get(clientId),
  });

  const rawBudgetUrl = client?.budget_url;
  // Only allow http/https URLs to prevent javascript: and other dangerous schemes in href/src
  const budgetUrl = rawBudgetUrl && /^https?:\/\//i.test(rawBudgetUrl) ? rawBudgetUrl : null;

  const startEdit = () => {
    setUrlInput(budgetUrl || "");
    setEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await base44.entities.Client.update(clientId, { budget_url: urlInput.trim() });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  // Convert a Dropbox share link to a direct-download URL that viewers can fetch
  const getDirectUrl = (url) => {
    if (!url) return null;
    let direct = url;
    if (direct.includes("dropbox.com")) {
      // Change dl=0 → dl=1 for direct file download (preserves rlkey auth)
      direct = direct.replace("dl=0", "dl=1");
    }
    // Cache-buster so the Office Online viewer fetches the latest file from Dropbox
    const sep = direct.includes("?") ? "&" : "?";
    return `${direct}${sep}cb=${refreshKey}`;
  };

  const directUrl = budgetUrl ? getDirectUrl(budgetUrl) : null;
  // Use Microsoft Office Online viewer for Excel files (handles Dropbox direct links)
  const viewerUrl = directUrl
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(directUrl)}`
    : null;

  // Reset the loaded flag whenever the document URL changes
  useEffect(() => {
    setIframeLoaded(false);
  }, [viewerUrl]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <Link to={`/clients/${clientId}/draws`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft className="w-4 h-4" />Back to Draws
      </Link>

      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-600" />
            Budget
          </h1>
          <p className="text-sm text-slate-500">{client?.name || "Loading..."} — budget & progress</p>
        </div>
        <div className="flex items-center gap-2">
          {budgetUrl && (
            <a href={budgetUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="w-3.5 h-3.5 mr-1" />Open Original
              </Button>
            </a>
          )}
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Pencil className="w-3.5 h-3.5 mr-1" />{budgetUrl ? "Update Link" : "Set Link"}
          </Button>
        </div>
      </div>

      {editing && (
        <form onSubmit={handleSave} className="mb-6 bg-white border rounded-xl p-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Budget Document URL (Dropbox share link or direct file URL)</Label>
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://www.dropbox.com/scl/fi/.../Budget.xlsx?dl=0"
            />
            <p className="text-xs text-slate-500">Paste the Dropbox shared link to the budget Excel file. It will auto-update whenever the file in Dropbox changes.</p>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : !budgetUrl ? (
        <div className="text-center py-16 text-slate-400 border border-dashed rounded-xl">
          <DollarSign className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="mb-1">No budget document linked yet.</p>
          <p className="text-sm">Click "Set Link" above to paste the Dropbox shared link.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-slate-50">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={zoomOut} disabled={zoom <= 0.5}>
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={zoomIn} disabled={zoom >= 2}>
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={resetZoom}>
                <Maximize className="w-4 h-4" />
              </Button>
              {zoom > 1 && (
                <Button
                  variant={panMode ? "default" : "outline"}
                  size="icon"
                  onClick={() => setPanMode((p) => !p)}
                  title={panMode ? "Pan mode (drag to move)" : "Interact mode (use document scrollbars)"}
                >
                  {panMode ? <Hand className="w-4 h-4" /> : <MousePointer className="w-4 h-4" />}
                </Button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setRefreshKey(Date.now()); setIframeLoaded(false); }}
              className="gap-1"
              title="Reload the latest version from Dropbox"
            >
              <RefreshCw className="w-3.5 h-3.5" />Refresh
            </Button>
            <span className="text-sm text-slate-500 tabular-nums">{Math.round(zoom * 100)}%</span>
          </div>
          <div
            ref={scrollRef}
            className="overflow-auto bg-slate-100 select-none"
            style={{ height: "75vh", cursor: zoom > 1 && panMode ? (isDragging ? "grabbing" : "grab") : "default" }}
            onMouseDown={handleMouseDown}
          >
            <div
              className="relative overflow-hidden"
              style={{ width: `${Math.max(zoom, 1) * 100}%`, height: `${75 * Math.max(zoom, 1)}vh` }}
            >
              {!iframeLoaded && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 pointer-events-none z-10">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
                    <span className="text-sm">Loading budget document...</span>
                  </div>
                </div>
              )}
              <div
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left",
                  width: `${100 / zoom}%`,
                  height: `${75 / zoom}vh`,
                }}
              >
                <iframe
                  src={viewerUrl}
                  className="bg-white border-0"
                  style={{ width: "100%", height: "100%", pointerEvents: zoom > 1 && panMode ? "none" : "auto" }}
                  title="Budget"
                  onLoad={() => setIframeLoaded(true)}
                  key={viewerUrl}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}