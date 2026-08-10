const normalizeHandoverHistory = (value) => {
  if (!value) return [];

  const rawItems = Array.isArray(value) ? value : [value];

  return rawItems
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        return item.name || item.by || item.user || item.workName || "";
      }
      return "";
    })
    .map((item) => String(item).replace(/ IPCS/gi, "").trim())
    .filter(Boolean);
};

const isTicketHandedOver = (ticket) =>
  normalizeHandoverHistory(ticket?.handover_history).length > 0;

export { normalizeHandoverHistory, isTicketHandedOver };