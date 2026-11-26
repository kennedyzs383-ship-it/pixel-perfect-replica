import { createFileRoute } from "@tanstack/react-router";
import { getEditorDraft, getSites, saveEditorDraft, updateSite } from "../lib/nuvem-workspace";
import { useEffect, useState } from "react";
import {
  ArrowLeft, ArrowDown, ArrowUp, Eye, Globe2, ImagePlus, LayoutTemplate,
  Monitor, Plus, Save, Smartphone, Trash2, Type, Download,
  Settings2, Palette, MousePointer2, Check, ExternalLink, Copy
} from "lucide-react";