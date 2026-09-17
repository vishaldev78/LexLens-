#!/usr/bin/env python3
"""Fix pipeline i18n keys in ui-i18n.ts: remove broken/duplicate inserts and
insert translated pipeline blocks cleanly before each locale's ft_tagline."""
import re

P = "/home/z/my-project/src/lib/lexlens/ui-i18n.ts"
src = open(P, encoding="utf-8").read()
lines = src.split("\n")

# 1. Drop every line that is a pl_* key or part of previous broken insert
cleaned = []
skip = False
for ln in lines:
    if re.match(r"^  (pl_title_running|pl_title_done|pl_stage_\d|pl_run_\d|ft_tagline:)\s*\"?|^  pl_stage_\d+:|^  pl_run_\d+:", ln) and ("Analyzing" in ln or "पाइपलाइन पूर्ण" in ln or True):
        # we handle pl_* and stray ft_tagline below more precisely
        pass
    cleaned.append(ln)

# Simpler robust approach: rebuild by regex on whole text
text = "\n".join(lines)

# Remove any previously inserted pipeline blocks (pl_* lines) entirely
text = re.sub(r"^  pl_[a-z_0-9]+: \"[^\"]*\",\n", "", text, flags=re.M)

# Fix duplicated ft_tagline key on one line: 'ft_tagline:  ft_tagline: "..."'
text = re.sub(r"^(  ft_tagline:)\s* ft_tagline:", r"\1", text, flags=re.M)
# Fix broken multiline: 'ft_tagline:\n  "AI...' pattern from EN insert (ft_tagline: followed by quoted value on next line)
text = re.sub(r"^(  ft_tagline:)\n(  \")", r"\1 \2".replace(" \2", r"\2"), text, flags=re.M)

BLOCKS = {
    "en": '''  pl_title_running: "Analyzing your notice…",
  pl_title_done: "Pipeline complete",
  pl_stage_1: "Preprocess input",
  pl_stage_2: "Text extraction (OCR)",
  pl_stage_3: "Language detection",
  pl_stage_4: "Jurisdiction detection",
  pl_stage_5: "Notice classification",
  pl_stage_6: "Entity extraction",
  pl_stage_7: "Corpus retrieval",
  pl_stage_8: "Analysis + safety pass",
  pl_stage_9: "Action plan ready",
  pl_run_1: "Normalizing characters, stripping headers…",
  pl_run_2: "Reconstructing document layout…",
  pl_run_3: "Scoring 40+ scripts & languages…",
  pl_run_4: "Matching sender, court and statute clues…",
  pl_run_5: "Mapping to notice taxonomy…",
  pl_run_6: "Extracting sender, demands, deadlines…",
  pl_run_7: "Searching jurisdiction-filtered statute corpus…",
  pl_run_8: "Verifying citations against corpus…",
  pl_run_9: "Assembling plain-language breakdown…",
''',
    "hi": '''  pl_title_running: "आपके नोटिस का विश्लेषण हो रहा है…",
  pl_title_done: "पाइपलाइन पूर्ण",
  pl_stage_1: "इनपुट प्रीप्रोसेस",
  pl_stage_2: "टेक्स्ट निष्कर्षण (OCR)",
  pl_stage_3: "भाषा पहचान",
  pl_stage_4: "क्षेत्राधिकार पहचान",
  pl_stage_5: "नोटिस वर्गीकरण",
  pl_stage_6: "एंटिटी निष्कर्षण",
  pl_stage_7: "कॉर्पस खोज",
  pl_stage_8: "विश्लेषण + सुरक्षा पास",
  pl_stage_9: "कार्य योजना तैयार",
  pl_run_1: "अक्षर सामान्यीकरण, हेडर हटाना…",
  pl_run_2: "दस्तावेज़ लेआउट पुनर्निर्माण…",
  pl_run_3: "40+ लिपियों व भाषाओं का स्कोरिंग…",
  pl_run_4: "प्रेषक, अदालत व कानून संकेतों का मिलान…",
  pl_run_5: "नोटिस वर्गीकरण श्रेणी में मैपिंग…",
  pl_run_6: "प्रेषक, मांगें, समा-सीमाएँ निकालना…",
  pl_run_7: "क्षेत्राधिकार-फ़िल्टर्ड कानून कॉर्पस खोज…",
  pl_run_8: "कॉर्पस से संदर्भ सत्यापन…",
  pl_run_9: "आसान भाषा की व्याख्या तैयार…",
''',
    "zh": '''  pl_title_running: "正在分析您的通知…",
  pl_title_done: "流水线已完成",
  pl_stage_1: "输入预处理",
  pl_stage_2: "文本提取（OCR）",
  pl_stage_3: "语言检测",
  pl_stage_4: "司法管辖区检测",
  pl_stage_5: "通知分类",
  pl_stage_6: "实体提取",
  pl_stage_7: "法条库检索",
  pl_stage_8: "分析 + 安全审查",
  pl_stage_9: "行动方案就绪",
  pl_run_1: "规范化字符、清理信头…",
  pl_run_2: "重建文档版面…",
  pl_run_3: "对 40+ 文字系统与语言评分…",
  pl_run_4: "匹配发件方、法院与法条线索…",
  pl_run_5: "映射到通知分类体系…",
  pl_run_6: "提取发件方、诉求、截止日期…",
  pl_run_7: "检索按管辖区过滤的法条库…",
  pl_run_8: "对照法条库核验引用…",
  pl_run_9: "汇总生成通俗解读…",
''',
    "fr": '''  pl_title_running: "Analyse de votre avis en cours…",
  pl_title_done: "Pipeline terminé",
  pl_stage_1: "Prétraitement de l'entrée",
  pl_stage_2: "Extraction du texte (OCR)",
  pl_stage_3: "Détection de la langue",
  pl_stage_4: "Détection de la juridiction",
  pl_stage_5: "Classification de l'avis",
  pl_stage_6: "Extraction des entités",
  pl_stage_7: "Recherche dans le corpus",
  pl_stage_8: "Analyse + passage de sécurité",
  pl_stage_9: "Plan d'action prêt",
  pl_run_1: "Normalisation des caractères, nettoyage des en-têtes…",
  pl_run_2: "Reconstruction de la mise en page…",
  pl_run_3: "Notation de 40+ écritures et langues…",
  pl_run_4: "Correspondance expéditeur, tribunal et textes…",
  pl_run_5: "Association à la taxonomie des avis…",
  pl_run_6: "Extraction expéditeur, exigences, délais…",
  pl_run_7: "Recherche dans le corpus filtré par juridiction…",
  pl_run_8: "Vérification des références vs corpus…",
  pl_run_9: "Assemblage de l'explication en langage clair…",
''',
}

# Insert each block right before the ft_tagline line inside its locale const.
def insert_for_locale(text: str, locale: str, block: str) -> str:
    # find the const block start
    m = re.search(rf"^const {locale}(?:: UiStrings)? = \{{", text, flags=re.M)
    if not m:
        raise SystemExit(f"locale const {locale} not found")
    start = m.end()
    # find ft_tagline within this const (before the next "const " or export)
    nxt = re.search(r"^(const [a-z]+|export const)", text[start:], flags=re.M)
    end = start + (nxt.start() if nxt else len(text) - start)
    seg = text[start:end]
    ftm = re.search(r"^  ft_tagline:", seg, flags=re.M)
    if not ftm:
        raise SystemExit(f"ft_tagline not found in {locale}")
    seg_new = seg[: ftm.start()] + block + seg[ftm.start():]
    return text[:start] + seg_new + text[end:]

for loc in ["en", "hi", "zh", "fr"]:
    text = insert_for_locale(text, loc, BLOCKS[loc])

open(P, "w", encoding="utf-8").write(text)
print("OK — pipeline keys inserted for en/hi/zh/fr")
