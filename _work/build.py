from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor

W, H = 960, 540
IMG = "C:/Users/HP/Desktop/global hack/_work/img/x%d.png"
OUT = "C:/Users/HP/Desktop/global hack/CBC014_Full-stack-Web-Development.pdf"
F = "C:/Windows/Fonts/"
pdfmetrics.registerFont(TTFont("Cal", F + "calibri.ttf"))
pdfmetrics.registerFont(TTFont("CalB", F + "calibrib.ttf"))
pdfmetrics.registerFont(TTFont("CamB", F + "cambriab.ttf"))

NAVY, NAVY2 = "#071a3d", "#0f2f6b"
BLUE, DBLUE, ORANGE, TEAL, GOLD = "#1f6feb", "#0b4fc4", "#e8512f", "#0e8f83", "#ffc21a"
PALE, GREY, WHITE, LINE = "#eef4fd", "#5f6f8c", "#ffffff", "#cfddf5"

TEAM_ID = "CBC014"
DOMAIN = "Full stack / Web Development"

c = canvas.Canvas(OUT, pagesize=(W, H))
c.setTitle("CBC 2.0 Design Round - VYBE - Team RUNTIME TERROR")
c.setAuthor("Team RUNTIME TERROR")
warnings = []


def Y(y):
    return H - y


def rect(x0, y0, x1, y1, fill, r=0, stroke=None):
    c.setFillColor(HexColor(fill))
    if stroke:
        c.setStrokeColor(HexColor(stroke))
    if r:
        c.roundRect(x0, Y(y1), x1 - x0, y1 - y0, r, stroke=0, fill=1)
    else:
        c.rect(x0, Y(y1), x1 - x0, y1 - y0, stroke=0, fill=1)


def circle(x0, y0, x1, y1, fill):
    c.setFillColor(HexColor(fill))
    c.ellipse(x0, Y(y1), x1, Y(y0), stroke=0, fill=1)


def text(x, base, s, font, size, color, space=0, align="l"):
    c.setFillColor(HexColor(color))
    t = c.beginText()
    w = pdfmetrics.stringWidth(s, font, size) + space * len(s)
    if align == "r":
        x -= w
    elif align == "c":
        x -= w / 2
    t.setTextOrigin(x, Y(base))
    t.setFont(font, size)
    t.setCharSpace(space)
    t.textOut(s)
    c.drawText(t)


def wrap(s, font, size, width):
    lines, cur = [], ""
    for w in s.split():
        trial = (cur + " " + w).strip()
        if pdfmetrics.stringWidth(trial, font, size) <= width:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines


def para(x, base, s, font, size, color, width, lead, max_lines=None, tag=""):
    lines = wrap(s, font, size, width)
    if max_lines and len(lines) > max_lines:
        warnings.append("OVERFLOW %s: %d lines > %d: %s" % (tag, len(lines), max_lines, s[:40]))
    for i, ln in enumerate(lines):
        text(x, base + i * lead, ln, font, size, color)
    return len(lines)


def icon(xref, cx, cy, size):
    c.drawImage(IMG % xref, cx - size / 2, Y(cy) - size / 2, size, size, mask="auto")


def footer(n, dark=False):
    col = PALE if dark else GREY
    text(43, 515.4, "CBC 2.0   |   Design Round   |   Team ID: %s   |   Domain: %s" % (TEAM_ID, DOMAIN), "Cal", 12, col)
    text(907, 515.4, str(n), "Cal", 12, col, align="r")


def title(s, color=NAVY):
    text(43, 74.7, s, "CamB", 36, color)


def small_logo():
    c.drawImage(IMG % 16, 860, Y(86), 55, 61, mask="auto")


# ---------------------------------------------------------------- 1 TITLE
rect(0, 0, W, H, NAVY)
text(57.6, 112.2, "CBC 2.0  \u2022  HACKATHON", "CalB", 16, GOLD, space=3.4)
text(57.6, 239.3, "Design Round", "CamB", 56, WHITE)
text(57.6, 283.5, "VYBE", "CalB", 22, WHITE)
text(57.6 + pdfmetrics.stringWidth("VYBE", "CalB", 22), 283.5,
     "  \u2014  AI-Powered Campus Volunteer Intelligence", "Cal", 22, PALE)
text(57.6, 316, "The right people. The right event. The right time.", "CalB", 20, GOLD)
boxes = [("TEAM NAME", "RUNTIME TERROR", 112), ("TEAM ID", TEAM_ID, 88),
         ("DOMAIN", DOMAIN, 140), ("COLLEGE", "Adichunchanagiri Institute of Technology", 183)]
x = 57.6
for lab, val, w in boxes:
    rect(x, 374.4, x + w, 453.6, NAVY2, r=10)
    text(x + 10.8, 393.4, lab, "CalB", 11, PALE, space=0.8)
    para(x + 10.8, 413.5, val, "CalB", 14, WHITE, w - 21.6, 17, max_lines=3, tag="title box")
    x += w + 10.8
c.drawImage(IMG % 16, 619, Y(436), 309, 346, mask="auto")
c.showPage()

# ---------------------------------------------------------------- 2 PROBLEM STATEMENT
rect(0, 0, W, H, NAVY)
title("Problem Statement", WHITE)
small_logo()
rect(43.2, 122.4, 633.6, 468, NAVY2, r=12)
circle(68.4, 144, 126, 201.6, ORANGE)
icon(89, 97.2, 172.8, 28)
text(144, 173.4, "PROBLEM STATEMENT (AS GIVEN)", "CalB", 16, GOLD, space=1.6)
text(68.4, 252, "Event Volunteer Allocation", "CamB", 34, WHITE)
rect(68.4, 290, 118, 293, GOLD)
text(68.4, 326, "WHAT THIS MEANS FOR OUR CAMPUS", "CalB", 14, GOLD, space=1.4)
para(68.4, 358, "Matching student volunteers to the right roles, shifts and events fairly, "
     "without clashes, and with the organizer in control.", "Cal", 22, WHITE, 540, 29, max_lines=4, tag="ps")
cards = [("PROBLEM ID", "PS-009", 122.4), ("DOMAIN", DOMAIN, 241.2),
         ("OUR FOCUS", "Fair, explainable volunteer matching", 360)]
for lab, val, y in cards:
    rect(662.4, y, 916.6, y + 108, BLUE, r=12)
    text(680, y + 29.3, lab, "CalB", 12, PALE, space=1.2)
    para(680, y + 63.6, val, "CalB", 18, WHITE, 218, 22, max_lines=2, tag="ps card")
footer(2, dark=True)
c.showPage()

# ---------------------------------------------------------------- 3 UNDERSTANDING THE PROBLEM
rect(0, 0, W, H, WHITE)
title("Understanding the Problem")
small_logo()
cols = [
    (43.2, 329.0, BLUE, 134, "Who is affected?",
     ["Student volunteers whose skills go unnoticed",
      "Organizers and faculty coordinating events",
      "Every club and fest across branches"]),
    (337.0, 622.8, ORANGE, 136, "What is going wrong?",
     ["Manual picking over chats and forms is slow",
      "Skills do not match roles; schedules clash",
      "The same few students get chosen repeatedly"]),
    (630.7, 916.6, TEAL, 138, "Why does it matter?",
     ["Events run understaffed or poorly organised",
      "New volunteers never get a chance to grow",
      "More events each year means manual work won\u2019t scale"]),
]
for x0, x1, colr, ic, head, bullets in cols:
    rect(x0, 122.4, x1, 468, PALE, r=12)
    circle(x0 + 25.2, 147.6, x0 + 90, 212.4, colr)
    icon(ic, x0 + 57.6, 180, 31)
    text(x0 + 25.2, 255.6, head, "CalB", 22, NAVY)
    yy = 299.5
    for b in bullets:
        circle(x0 + 25.2, yy - 8, x0 + 30.2, yy - 3, GREY)
        n = para(x0 + 51.8, yy, b, "Cal", 16, GREY, x1 - x0 - 51.8 - 14, 20, max_lines=3, tag="s3")
        yy += 20 * n + 14
footer(3)
c.showPage()

# ---------------------------------------------------------------- 4 PROPOSED SOLUTION
rect(0, 0, W, H, WHITE)
title("Our Proposed Solution")
small_logo()
rect(43.2, 122.4, 439.2, 468, BLUE, r=12)
circle(68.4, 144, 133.2, 208.8, GOLD)
icon(213, 100.8, 176.4, 31)
text(68.4, 239.9, "THE IDEA IN ONE LINE", "CalB", 14, PALE, space=2)
para(68.4, 286.2, "We help organizers staff events fairly and students find the right roles, "
     "by pairing rule-based allocation with explainable AI, unlike manual forms and chat groups.",
     "CamB", 22, WHITE, 350, 28.8, max_lines=7, tag="idea")
text(468, 143.1, "How it works", "CalB", 22, NAVY)
steps = [("Step 1 \u2014 Input", "Organizers define events and roles; students add profile and availability and apply"),
         ("Step 2 \u2014 Process", "Rules filter eligibility and clashes, then rank the best fits and balance workload"),
         ("Step 3 \u2014 Outcome", "Organizer approves explainable picks; volunteers get roles, reminders and growth paths")]
for i, (h, d) in enumerate(steps):
    y = 165.6 + i * 100.8
    rect(468, y, 916.6, y + 86.4, PALE, r=10)
    circle(486, y + 21.6, 529.2, y + 64.8, ORANGE)
    text(507.6, y + 49.3, str(i + 1), "CalB", 18, WHITE, align="c")
    text(547, y + 31.3, h, "CalB", 18, NAVY)
    para(547, y + 55.9, d, "Cal", 14, GREY, 350, 16.5, max_lines=2, tag="step")
footer(4)
c.showPage()

# ---------------------------------------------------------------- 5 KEY FEATURES
rect(0, 0, W, H, WHITE)
title("Key Features")
small_logo()
feats = [
    ("Smart Allocation", "Filters by eligibility, availability and clashes, then ranks the best-fit volunteers.", 277, BLUE),
    ("AI Event Co-Pilot", "Suggests roles, staffing, schedules and checklists. Organizers can edit everything.", 279, ORANGE),
    ("AI Volunteer Guide", "Recommends events with reasons and a skill roadmap, based on the student\u2019s own inputs.", 285, TEAL),
    ("Profiles & Applications", "One profile for skills, availability and history, with role-wise applications and status.", 287, DBLUE),
    ("Event Coordination", "Role schedules, reminders, QR attendance, venue maps and opt-in location sharing.", 283, BLUE),
    ("Fair & Transparent", "Role-based access, explainable picks and organizer approval on every decision.", 281, ORANGE),
]
xs = [(43.2, 329.0), (337.0, 622.8), (630.7, 916.6)]
for i, (name, desc, ic, colr) in enumerate(feats):
    x0, x1 = xs[i % 3]
    y0 = 122.4 + (i // 3) * 183.6
    rect(x0, y0, x1, y0 + 161.6, PALE, r=12)
    circle(x0 + 21.6, y0 + 21.6, x0 + 72, y0 + 72, colr)
    icon(ic, x0 + 46.8, y0 + 46.8, 25)
    text(x0 + 86.4, y0 + 52.5, name, "CalB", 18, NAVY)
    para(x0 + 21.6, y0 + 102.6, desc, "Cal", 14, GREY, x1 - x0 - 43.2, 17, max_lines=3, tag="feat")
footer(5)
c.showPage()

# ---------------------------------------------------------------- 6 ARCHITECTURE
rect(0, 0, W, H, WHITE)
title("Architecture & Tech Stack")
small_logo()
layers = [(122.4, 223.2, NAVY2, 358, "User layer",
           "Web app for students and organizers, with role-based dashboards"),
          (241.2, 342.0, BLUE, 360, "Application layer",
           "Allocation engine, conflict checks, scheduling, notifications and AI calls"),
          (360.0, 460.8, TEAL, 362, "Data & AI layer",
           "Profiles, events and attendance data; AI only suggests and never decides eligibility")]
for y0, y1, colr, ic, h, d in layers:
    rect(43.2, y0, 590.4, y1, colr, r=12)
    circle(68.4, y0 + 21.6, 126, y0 + 79.2, ORANGE)
    icon(ic, 97.2, y0 + 50.4, 28)
    text(148, y0 + 38.9, h, "CalB", 20, WHITE)
    para(148, y0 + 69.3, d, "Cal", 14, WHITE, 425, 17, max_lines=2, tag="layer")
rect(619.2, 122.4, 916.6, 460.8, PALE, r=12)
text(644, 161.1, "Tech stack", "CalB", 22, NAVY)
stack = [("Design", "Figma"), ("Frontend", "React + Tailwind CSS"), ("Backend", "Node.js + Express"),
         ("Database", "PostgreSQL"), ("AI / APIs", "LLM API, Maps API")]
for i, (k, v) in enumerate(stack):
    yy = 209.9 + i * 53.3
    text(644, yy, k, "CalB", 14, BLUE)
    text(749, yy, v, "Cal", 14, GREY)
footer(6)
c.showPage()

# ---------------------------------------------------------------- 7 INNOVATION
rect(0, 0, W, H, WHITE)
title("Innovation & Differentiation")
small_logo()
cx = [43.2, 252.0, 583.2, 916.6]
for i, h in enumerate(["Aspect", "Existing solutions", "Our solution"]):
    rect(cx[i], 122.4, cx[i + 1], 165.6, BLUE)
    text(cx[i] + 10.8, 149.4, h, "CalB", 16, WHITE)
rows = [("Ease of use", "Manual forms, chat groups and spreadsheets",
         "One platform to apply, match, confirm and coordinate"),
        ("Cost / access", "Scattered tools; roles visible to only a few students",
         "Open to every student, at branch or college level"),
        ("Personalization", "One-size-fits-all calls with no guidance on fit",
         "Matched events, with reasons and a skill roadmap"),
        ("Scalability", "Effort grows with every new event and volunteer",
         "Same rules and ranking work for any event size")]
for r, (a, e, o) in enumerate(rows):
    y0 = 165.6 + r * 57.6
    rect(cx[0], y0, cx[1], y0 + 57.6, PALE)
    mid = y0 + 28.8
    text(cx[0] + 10.8, mid + 4.7, a, "CalB", 14, NAVY)
    for j, s in ((1, e), (2, o)):
        ls = wrap(s, "Cal", 14, cx[j + 1] - cx[j] - 21.6)
        if len(ls) > 2:
            warnings.append("table overflow " + s)
        b = mid + 4.7 - (len(ls) - 1) * 8.5
        for k, ln in enumerate(ls):
            text(cx[j] + 10.8, b + k * 17, ln, "Cal", 14, GREY)
c.setStrokeColor(HexColor(LINE))
c.setLineWidth(0.8)
for xx in cx:
    c.line(xx, Y(122.4), xx, Y(396))
for r in range(6):
    yy = 122.4 + (0 if r == 0 else 43.2 + (r - 1) * 57.6)
    c.line(43.2, Y(yy), 916.6, Y(yy))
c.line(43.2, Y(396), 916.6, Y(396))
rect(43.2, 421.2, 916.6, 475.2, ORANGE, r=10)
text(68.4, 454.3, "Our unique edge: fair, explainable allocation where AI advises and organizers decide.",
     "CalB", 18, WHITE)
footer(7)
c.showPage()

# ---------------------------------------------------------------- 8 IMPACT
rect(0, 0, W, H, WHITE)
title("Impact, Feasibility & Risks")
small_logo()
items = [(BLUE, 515, "Impact",
          "Less manual coordination for organizers; fairer, better-matched roles and skill growth for students."),
         (TEAL, 517, "Feasibility",
          "Uses standard web technology and existing AI APIs, so a small team can build a working core."),
         (DBLUE, 519, "Scalability",
          "The same rules run for any event size, from one branch to the whole college and other campuses."),
         (ORANGE, 281, "Risks & mitigation",
          "Wrong AI advice or data misuse: rules decide eligibility, organizers approve, access is role-based, location is opt-in.")]
for i, (colr, ic, h, d) in enumerate(items):
    y0 = 122.4 + i * 90
    rect(43.2, y0, 288, y0 + 75.6, colr, r=10)
    circle(61.2, y0 + 12.2, 111.6, y0 + 62.6, NAVY)
    icon(ic, 86.4, y0 + 37.4, 25)
    text(122, y0 + 43.8, h, "CalB", 18, WHITE)
    rect(302.4, y0, 916.6, y0 + 75.6, PALE, r=10)
    ls = wrap(d, "Cal", 14, 575)
    if len(ls) > 3:
        warnings.append("impact overflow " + h)
    b = y0 + 42.5 - (len(ls) - 1) * 8.5
    for k, ln in enumerate(ls):
        text(324, b + k * 17, ln, "Cal", 14, GREY)
footer(8)
c.showPage()

c.save()
print("saved", OUT)
for w in warnings:
    print(w)
