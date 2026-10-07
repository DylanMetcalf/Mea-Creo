import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  CreditCard,
  FolderOpen,
  Home,
  Layers,
  ListChecks,
  MessageCircle,
  Sparkles,
  Target,
} from "lucide-react";

/** Portal navigation, shared by the client nav components and server pages. */
export const PORTAL_NAV = [
  { href: "/portal", label: "Home", icon: Home },
  { href: "/portal/approvals", label: "Approvals", icon: CheckSquare },
  { href: "/portal/work", label: "Work", icon: ListChecks },
  { href: "/portal/reports", label: "Reports", icon: BarChart3 },
  { href: "/portal/services", label: "Services", icon: Layers },
  { href: "/portal/prospects", label: "Prospects", icon: Target },
  { href: "/portal/files", label: "Files", icon: FolderOpen },
  { href: "/portal/meetings", label: "Meetings", icon: CalendarDays },
  { href: "/portal/billing", label: "Billing", icon: CreditCard },
  { href: "/portal/messages", label: "Messages", icon: MessageCircle },
  { href: "/portal/ask", label: "Ask Mea Creo", icon: Sparkles },
] as const;
