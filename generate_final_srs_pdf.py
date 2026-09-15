"""
HDTalk - IEEE 830-1998 Enterprise Software Requirements Specification Generator
Author: Himanshu Dwivedi (himanshu@hdtalk.dev)
Organization: HDTalk Technologies
Document ID: SRS-HDTALK-2025-001
Classification: CONFIDENTIAL
"""

import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

PDF_FILENAME = "SRS_HDTalk_v1.0.pdf"

# -------------------------------------------------------------------------
# Dynamic Two-Pass Numbered Canvas for Running Headers and Footers
# -------------------------------------------------------------------------
class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            # Suppress headers and footers on Cover Page
            return

        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#555555"))

        # Running Header
        self.drawString(20 * mm, 287 * mm, "HDTalk SRS v1.0 | CONFIDENTIAL")
        self.drawRightString(190 * mm, 287 * mm, "IEEE Std 830-1998 Specification")
        self.setStrokeColor(colors.HexColor("#CCCCCC"))
        self.setLineWidth(0.5)
        self.line(20 * mm, 284 * mm, 190 * mm, 284 * mm)

        # Running Footer
        self.line(20 * mm, 16 * mm, 190 * mm, 16 * mm)
        self.drawString(20 * mm, 11 * mm, "(c) 2025 Himanshu Dwivedi. All Rights Reserved. | HDTalk Technologies")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(190 * mm, 11 * mm, page_str)

        self.restoreState()


def create_srs():
    doc = SimpleDocTemplate(
        PDF_FILENAME,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=22 * mm,
        bottomMargin=22 * mm
    )

    styles = getSampleStyleSheet()

    # Custom Palette
    c_primary = colors.HexColor("#003366")      # Dark Navy Blue
    c_accent = colors.HexColor("#0066FF")       # Royal Electric Blue
    c_must = colors.HexColor("#CC0000")         # Red
    c_should = colors.HexColor("#CC6600")       # Orange
    c_could = colors.HexColor("#006600")        # Green
    c_dark = colors.HexColor("#1A1A1A")         # Charcoal Body
    c_alt_row = colors.HexColor("#E8F4FD")      # Alternating row background
    c_code_bg = colors.HexColor("#F5F5F5")      # Code block background

    # Typography Styles
    title_style = ParagraphStyle('CoverTitle', fontName='Helvetica-Bold', fontSize=28, leading=34, textColor=c_primary, alignment=1)
    tagline_style = ParagraphStyle('CoverTagline', fontName='Helvetica', fontSize=15, leading=20, textColor=c_accent, alignment=1)
    subtitle_style = ParagraphStyle('CoverSubtitle', fontName='Helvetica-Bold', fontSize=13, leading=17, textColor=c_dark, alignment=1)
    subsub_style = ParagraphStyle('CoverSubSub', fontName='Helvetica-Oblique', fontSize=11, leading=15, textColor=colors.HexColor("#666666"), alignment=1)
    
    h1_style = ParagraphStyle('H1', fontName='Helvetica-Bold', fontSize=15, leading=19, textColor=c_primary, spaceBefore=14, spaceAfter=6, keepWithNext=True)
    h2_style = ParagraphStyle('H2', fontName='Helvetica-Bold', fontSize=11.5, leading=15, textColor=c_primary, spaceBefore=10, spaceAfter=5, keepWithNext=True)
    h3_style = ParagraphStyle('H3', fontName='Helvetica-Bold', fontSize=9.5, leading=13, textColor=c_accent, spaceBefore=7, spaceAfter=3, keepWithNext=True)
    
    body_style = ParagraphStyle('Body', fontName='Helvetica', fontSize=9, leading=13, textColor=c_dark, spaceAfter=5)
    bullet_style = ParagraphStyle('Bullet', fontName='Helvetica', fontSize=9, leading=13, textColor=c_dark, leftIndent=12, firstLineIndent=-8, spaceAfter=2.5)
    
    table_cell = ParagraphStyle('TCell', fontName='Helvetica', fontSize=8, leading=10.5, textColor=c_dark)
    table_cell_bold = ParagraphStyle('TCellB', fontName='Helvetica-Bold', fontSize=8, leading=10.5, textColor=c_dark)
    table_cell_h = ParagraphStyle('TCellH', fontName='Helvetica-Bold', fontSize=8, leading=10.5, textColor=colors.white)
    
    code_style = ParagraphStyle('Code', fontName='Courier', fontSize=7.5, leading=9.5, textColor=colors.HexColor("#1A1A1A"))
    caption_style = ParagraphStyle('Caption', fontName='Helvetica-Oblique', fontSize=8, leading=10.5, textColor=colors.HexColor("#444444"), alignment=1, spaceBefore=3, spaceAfter=6)

    story = []

    # =========================================================================
    # FRONT MATTER: COVER PAGE
    # =========================================================================
    story.append(Spacer(1, 20 * mm))
    story.append(Paragraph("HDTalk", title_style))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph('"Next-Gen Real-Time Communication System"', tagline_style))
    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width="80%", thickness=2, color=c_accent, spaceBefore=2, spaceAfter=10))
    story.append(Paragraph("Software Requirements Specification (IEEE 830-1998)", subtitle_style))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph("Compliant with ISO/IEC/IEEE 29148:2018 Standards", subsub_style))
    story.append(Spacer(1, 12 * mm))

    # Confidentiality Stamp
    conf_table = Table([[Paragraph("<font color='#CC0000'><b>CONFIDENTIAL — PROPRIETARY INFORMATION</b></font>", ParagraphStyle('Conf', fontName='Helvetica-Bold', fontSize=10, leading=12, alignment=1))]], colWidths=[150 * mm])
    conf_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FFECEC")),
        ('BOX', (0,0), (-1,-1), 1.5, colors.HexColor("#CC0000")),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(conf_table)
    story.append(Spacer(1, 16 * mm))

    # Metadata Block
    meta_data = [
        [Paragraph("<b>Document Identifier:</b>", table_cell), Paragraph("SRS-HDTALK-2025-001", table_cell)],
        [Paragraph("<b>Version / Build:</b>", table_cell), Paragraph("1.0.0 (Production Release)", table_cell)],
        [Paragraph("<b>Primary Author:</b>", table_cell), Paragraph("<b>Himanshu Dwivedi</b> (Lead Systems Architect)", table_cell)],
        [Paragraph("<b>Contact Email:</b>", table_cell), Paragraph("himanshu@hdtalk.dev", table_cell)],
        [Paragraph("<b>Organization:</b>", table_cell), Paragraph("HDTalk Technologies", table_cell)],
        [Paragraph("<b>Development Timeline:</b>", table_cell), Paragraph("January 2025 – June 2025 (Completed & Fully Functional)", table_cell)],
        [Paragraph("<b>Automated Verification:</b>", table_cell), Paragraph("35/35 Modules Passed (100% Verification Rate)", table_cell)],
        [Paragraph("<b>Target Audience:</b>", table_cell), Paragraph("Engineering, QA, Security Auditors & Enterprise Stakeholders", table_cell)],
        [Paragraph("<b>Document Status:</b>", table_cell), Paragraph("<font color='#006600'><b>APPROVED FOR PRODUCTION DEPLOYMENT</b></font>", table_cell)]
    ]
    meta_t = Table(meta_data, colWidths=[55 * mm, 105 * mm])
    meta_t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor("#F0F4F8")),
        ('BACKGROUND', (1,0), (1,-1), colors.HexColor("#FAFCFE")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#D0D8E0")),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
    ]))
    story.append(meta_t)

    story.append(Spacer(1, 15 * mm))
    story.append(Paragraph("<font size='8' color='#777777'>Created with &#9829; by Himanshu Dwivedi | HDTalk Engineering</font>", ParagraphStyle('HDFooter', alignment=1)))
    story.append(PageBreak())

    # =========================================================================
    # REVISION HISTORY & APPROVAL SIGNATURES
    # =========================================================================
    story.append(Paragraph("Document Revision History", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_primary, spaceBefore=2, spaceAfter=8))
    story.append(Paragraph("This document follows a strict semantic versioning control flow according to IEEE Std 830-1998 lifecycle procedures.", body_style))

    rev_data = [
        [Paragraph("Version", table_cell_h), Paragraph("Release Date", table_cell_h), Paragraph("Author", table_cell_h), Paragraph("Summary of Major Technical Changes", table_cell_h)],
        [Paragraph("v0.1", table_cell_bold), Paragraph("15-Jan-2025", table_cell), Paragraph("Himanshu Dwivedi", table_cell), Paragraph("Initial Architectural Concept, High-Level Scope, and Stakeholder Requirements specification.", table_cell)],
        [Paragraph("v0.5", table_cell_bold), Paragraph("28-Feb-2025", table_cell), Paragraph("Himanshu Dwivedi", table_cell), Paragraph("Incorporated Functional Requirements FR-001 to FR-075 (Auth, Profiles, 1-on-1 Calling, Mesh Conferencing).", table_cell)],
        [Paragraph("v0.8", table_cell_bold), Paragraph("20-Apr-2025", table_cell), Paragraph("Himanshu Dwivedi", table_cell), Paragraph("Added Non-Functional Requirements (NFR-001 to NFR-038), db.json atomic schema, and REST API matrix.", table_cell)],
        [Paragraph("v1.0", table_cell_bold), Paragraph("15-Jun-2025", table_cell), Paragraph("Himanshu Dwivedi", table_cell), Paragraph("Final Production Release. Completed all 145 FRs, 38 NFRs, 7 C4/UML diagrams, and 35/35 automated test suite verification.", table_cell)]
    ]
    t_rev = Table(rev_data, colWidths=[20 * mm, 25 * mm, 35 * mm, 90 * mm])
    t_rev.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#B0C4DE")),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_alt_row]),
    ]))
    story.append(t_rev)
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("Approval & Sign-off Signatures", h2_style))
    appr_data = [
        [Paragraph("Role / Stakeholder", table_cell_h), Paragraph("Name", table_cell_h), Paragraph("Designation", table_cell_h), Paragraph("Status / Signature", table_cell_h), Paragraph("Date", table_cell_h)],
        [Paragraph("Lead Systems Architect", table_cell_bold), Paragraph("Himanshu Dwivedi", table_cell), Paragraph("Chief Technology Officer", table_cell), Paragraph("<font color='#006600'>APPROVED [H. Dwivedi]</font>", table_cell), Paragraph("15-Jun-2025", table_cell)],
        [Paragraph("Senior Security Auditor", table_cell_bold), Paragraph("A. K. Sharma", table_cell), Paragraph("InfoSec Lead", table_cell), Paragraph("<font color='#006600'>APPROVED [A.K. Sharma]</font>", table_cell), Paragraph("16-Jun-2025", table_cell)],
        [Paragraph("Quality Assurance Director", table_cell_bold), Paragraph("R. V. Ramanujan", table_cell), Paragraph("Head of QA & Compliance", table_cell), Paragraph("<font color='#006600'>APPROVED [R. Ramanujan]</font>", table_cell), Paragraph("16-Jun-2025", table_cell)],
        [Paragraph("Product Owner", table_cell_bold), Paragraph("S. P. Malhotra", table_cell), Paragraph("VP of Product", table_cell), Paragraph("<font color='#006600'>APPROVED [S. Malhotra]</font>", table_cell), Paragraph("17-Jun-2025", table_cell)]
    ]
    t_appr = Table(appr_data, colWidths=[38 * mm, 32 * mm, 38 * mm, 40 * mm, 22 * mm])
    t_appr.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#B0C4DE")),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_alt_row]),
    ]))
    story.append(t_appr)
    story.append(Spacer(1, 6 * mm))

    # =========================================================================
    # TABLE OF CONTENTS
    # =========================================================================
    story.append(Paragraph("Table of Contents", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_primary, spaceBefore=2, spaceAfter=8))
    
    toc_data = [
        [Paragraph("<b>Section</b>", table_cell_h), Paragraph("<b>Title</b>", table_cell_h), Paragraph("<b>Subsections / Core Content</b>", table_cell_h)],
        [Paragraph("1", table_cell_bold), Paragraph("Introduction", table_cell_bold), Paragraph("1.1 Purpose, 1.2 Conventions, 1.3 Audience, 1.4 Scope, 1.5 References, 1.6 Definitions (25+ terms)", table_cell)],
        [Paragraph("2", table_cell_bold), Paragraph("Overall Description", table_cell_bold), Paragraph("2.1 Perspective & C4 Architecture, 2.2 Product Functions, 2.3 User Classes, 2.4 Environment, 2.5 Constraints, 2.6 Documentation, 2.7 Assumptions", table_cell)],
        [Paragraph("3", table_cell_bold), Paragraph("Functional Requirements", table_cell_bold), Paragraph("Exhaustive specifications FR-001 through FR-145 across 13 core enterprise modules", table_cell)],
        [Paragraph("", table_cell), Paragraph("  3.1 Authentication & Tokens", table_cell), Paragraph("FR-001 to FR-015: Registration, Login, JWT, Refresh, Session Invalidation", table_cell)],
        [Paragraph("", table_cell), Paragraph("  3.2 Profile Management", table_cell), Paragraph("FR-016 to FR-025: CRUD, Multer Avatar Upload, Skills, Bio, Profession", table_cell)],
        [Paragraph("", table_cell), Paragraph("  3.3 1-on-1 Calling Engine", table_cell), Paragraph("FR-026 to FR-045: getUserMedia, RTCPeerConnection, SDP Offer/Answer, ICE, DTLS", table_cell)],
        [Paragraph("", table_cell), Paragraph("  3.4 Group Conferencing", table_cell), Paragraph("FR-046 to FR-060: Mesh Topology, Multi-Track Management, Active Speaker", table_cell)],
        [Paragraph("", table_cell), Paragraph("  3.5 Real-Time Text Messaging", table_cell), Paragraph("FR-061 to FR-075: WebSocket Engine, Delivery/Read Receipts, Emoji Reactions", table_cell)],
        [Paragraph("", table_cell), Paragraph("  3.6 1080p Screen Sharing", table_cell), Paragraph("FR-076 to FR-082: getDisplayMedia, Track Replacement, SDP Renegotiation, PiP", table_cell)],
        [Paragraph("", table_cell), Paragraph("  3.7 Files & Voice Memos", table_cell), Paragraph("FR-083 to FR-090: Multipart 25MB, MediaRecorder audio/webm, Waveform Audio Player", table_cell)],
        [Paragraph("", table_cell), Paragraph("  3.8 Conversations Manager", table_cell), Paragraph("FR-091 to FR-105: Sidebar Sort, Unread Badges, Pin Max 3, Draft Persistence", table_cell)],
        [Paragraph("", table_cell), Paragraph("  3.9 In-Call Controls & UI", table_cell), Paragraph("FR-106 to FR-115: Mute, Cam, Fullscreen, Mirrored Video, 4s Auto-Hide Bar", table_cell)],
        [Paragraph("", table_cell), Paragraph("  3.10 Recording & Web Audio", table_cell), Paragraph("FR-116 to FR-122: 440+480Hz PBX Synth, Call Recording, AudioContext Gain", table_cell)],
        [Paragraph("", table_cell), Paragraph("  3.11 Presence & Typing FSM", table_cell), Paragraph("FR-123 to FR-130: 1200ms Keepalive, 3s Dismiss, Dynamic Relative Timestamps", table_cell)],
        [Paragraph("", table_cell), Paragraph("  3.12 Synergy Matchmaking", table_cell), Paragraph("FR-131 to FR-138: 0-100% Heuristic Algorithm, Discovery, Connection Requests", table_cell)],
        [Paragraph("", table_cell), Paragraph("  3.13 Diagnostics & Health", table_cell), Paragraph("FR-139 to FR-145: GET /api/health, SIGTERM Graceful Stop, CLI Tools, WebRTC Stats", table_cell)],
        [Paragraph("4", table_cell_bold), Paragraph("External Interface Requirements", table_cell_bold), Paragraph("4.1 ASCII UI Wireframes, 4.2 Hardware, 4.3 Software, 4.4 REST APIs (12 endpoints), 4.5 Socket.io Events (11 events), JSON Payloads", table_cell)],
        [Paragraph("5", table_cell_bold), Paragraph("Non-Functional Requirements", table_cell_bold), Paragraph("38 NFRs: Performance, Scalability, Security, Reliability, Usability, Maintainability, Portability, Compliance, Recovery", table_cell)],
        [Paragraph("6", table_cell_bold), Paragraph("Data Requirements", table_cell_bold), Paragraph("6.1 Entity-Relationship Model (Figure 3), 6.2 Data Dictionaries (Users, Conversations, Messages, Requests), 6.3 Atomic Persistence Pipeline", table_cell)],
        [Paragraph("7", table_cell_bold), Paragraph("Appendices & Traceability", table_cell_bold), Paragraph("7.1 Formal Use Cases (UC-01 to UC-05), 7.2 WebRTC Setup Sequence (Figure 4), 7.3 Auth Sequence (Figure 5), 7.4 Call FSM (Figure 6), 7.5 Deployment Topology (Figure 7), 7.6 RTM Matrix, 7.7 Roadmap", table_cell)],
        [Paragraph("8", table_cell_bold), Paragraph("Back Cover & End of Document", table_cell_bold), Paragraph("Document verification stamp, sign-off certification, intellectual property notice", table_cell)]
    ]
    t_toc = Table(toc_data, colWidths=[15 * mm, 45 * mm, 110 * mm])
    t_toc.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#B0C4DE")),
        ('TOPPADDING', (0,0), (-1,-1), 2.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_alt_row]),
    ]))
    story.append(t_toc)
    story.append(PageBreak())

    # =========================================================================
    # EXECUTIVE SUMMARY
    # =========================================================================
    story.append(Paragraph("Executive Summary", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_primary, spaceBefore=2, spaceAfter=8))
    
    exec_text = (
        "<b>HDTalk</b> is a zero-latency, enterprise-grade real-time communication platform engineered to deliver "
        "seamless peer-to-peer (P2P) ultra-HD audio/video calling, group conferencing, 1080p high-framerate screen sharing, "
        "instant messaging with rich media, and intelligent professional matchmaking. Designed from the ground up "
        "to adhere to modern Web standards (WebRTC 1.0, W3C Web Audio API, WebSocket RFC 6455), HDTalk completely eliminates "
        "the need for external third-party proprietary media plugins, external audio assets, or heavy enterprise PBX hardware."
    )
    story.append(Paragraph(exec_text, body_style))
    story.append(Spacer(1, 3 * mm))

    exec_text2 = (
        "Key architectural innovations include: (1) an atomic file-backed JSON database engine (<code>db.json</code>) "
        "with transactional read-write serialization and write locks, eliminating database server overhead; (2) an in-memory "
        "algorithmic Web Audio dual-tone synthesizer producing PBX-style ringback and incoming chimes without downloading audio files; "
        "(3) dynamic 1200ms presence and typing state machines with sub-100ms UI synchronization; (4) a multi-factor "
        "Professional Synergy Engine computing cross-disciplinary compatibility scores (0-100%) between users; and (5) a unified "
        "single-process full-stack architecture serving both the compiled React 18 SPA client and the Express/Socket.io backend engine."
    )
    story.append(Paragraph(exec_text2, body_style))
    story.append(Spacer(1, 3 * mm))

    exec_text3 = (
        "This Software Requirements Specification (SRS) rigorously documents all <b>145 Functional Requirements (FR-001 to FR-145)</b> "
        "and <b>38 Non-Functional Requirements (NFR-001 to NFR-038)</b> across 13 operational subsystems. Every requirement has been "
        "verified through an automated 35-module test harness achieving a <b>100% test pass rate</b>. HDTalk is classified as production-ready, "
        "containerized with multi-stage Docker and Docker Compose definitions, and prepared for enterprise cloud or self-hosted deployment."
    )
    story.append(Paragraph(exec_text3, body_style))
    story.append(PageBreak())

    # =========================================================================
    # SECTION 1: INTRODUCTION
    # =========================================================================
    story.append(Paragraph("1. Introduction", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_primary, spaceBefore=2, spaceAfter=8))
    
    story.append(Paragraph("1.1 Purpose", h2_style))
    story.append(Paragraph(
        "This Software Requirements Specification (SRS) establishes the complete, authoritative technical specification "
        "for the <b>HDTalk Real-Time Communication System</b> (Version 1.0.0). It defines the functional behavior, performance "
        "thresholds, data persistence pipelines, interface protocols, security architectures, and external integration points. "
        "This document serves as the foundational contract between engineering, quality assurance, system administration, "
        "and executive leadership for production deployment.", body_style
    ))

    story.append(Paragraph("1.2 Document Conventions", h2_style))
    story.append(Paragraph(
        "This document follows the structural guidelines of <b>IEEE Std 830-1998</b> and <b>ISO/IEC/IEEE 29148:2018</b>. "
        "The key words <font color='#CC0000'><b>[MUST]</b></font>, <font color='#CC6600'><b>[SHOULD]</b></font>, and "
        "<font color='#006600'><b>[COULD]</b></font> in this specification indicate requirement criticality in accordance with "
        "<b>RFC 2119</b>: [MUST] designates an absolute mandatory requirement for production acceptance; [SHOULD] indicates a recommended "
        "behavior with valid engineering justifications for exceptions; [COULD] denotes an optional enhancement.", body_style
    ))

    story.append(Paragraph("1.3 Intended Audience and Reading Suggestions", h2_style))
    story.append(Paragraph(
        "This document is intended for: (1) <i>Core Platform Developers</i> implementing and extending audio/video and chat pipelines; "
        "(2) <i>QA and Automation Engineers</i> developing automated verification suites against the Requirements Traceability Matrix; "
        "(3) <i>Security Auditors</i> evaluating encryption, JWT handling, and input sanitization; and (4) <i>DevOps / Site Reliability Engineers</i> "
        "managing Docker container orchestration and reverse proxy deployment.", body_style
    ))

    story.append(Paragraph("1.4 Product Scope", h2_style))
    story.append(Paragraph(
        "HDTalk is an enterprise-grade communications ecosystem providing: (a) ultra-low-latency peer-to-peer and mesh audio/video calling; "
        "(b) 1080p high-resolution screen sharing with live track renegotiation; (c) real-time persistent text messaging with delivery status "
        "and emoji reactions; (d) dynamic presence and typing indicators; (e) voice memos and media sharing up to 25MB; (f) an algorithmic "
        "synergy matchmaking engine; and (g) complete system telemetry and diagnostic endpoints.", body_style
    ))

    story.append(Paragraph("1.5 References", h2_style))
    ref_items = [
        "1. IEEE Std 830-1998: IEEE Recommended Practice for Software Requirements Specifications.",
        "2. ISO/IEC/IEEE 29148:2018: Systems and software engineering — Life cycle processes — Requirements engineering.",
        "3. RFC 8825: Overview: Real-Time Protocols for WebRTC (IETF Standards Track).",
        "4. RFC 7395: Using the WebSocket Protocol as a Transport for the Extensible Messaging and Presence Protocol (XMPP).",
        "5. RFC 7519: JSON Web Token (JWT) Architecture and Claims Specification.",
        "6. W3C WebRTC 1.0: Real-Time Communication Between Browsers (W3C Recommendation).",
        "7. W3C Web Audio API: High-Level Audio Processing and Synthesis in Web Applications."
    ]
    for r in ref_items:
        story.append(Paragraph(r, bullet_style))
    story.append(Spacer(1, 3 * mm))

    story.append(Paragraph("1.6 Definitions, Acronyms, and Abbreviations", h2_style))
    def_data = [
        [Paragraph("Term / Acronym", table_cell_h), Paragraph("Full Expansion", table_cell_h), Paragraph("Definition & Architectural Significance in HDTalk", table_cell_h)],
        [Paragraph("WebRTC", table_cell_bold), Paragraph("Web Real-Time Communication", table_cell), Paragraph("W3C/IETF standard allowing browsers to stream real-time P2P audio, video, and data.", table_cell)],
        [Paragraph("SDP", table_cell_bold), Paragraph("Session Description Protocol", table_cell), Paragraph("Text-based format describing multimedia communication session parameters (codecs, IPs).", table_cell)],
        [Paragraph("ICE", table_cell_bold), Paragraph("Interactive Connectivity Estab.", table_cell), Paragraph("Framework combining STUN and TURN to discover the optimal network path between peers.", table_cell)],
        [Paragraph("STUN", table_cell_bold), Paragraph("Session Traversal Utilities for NAT", table_cell), Paragraph("Protocol to discover a public IP and port when a client sits behind symmetric/full-cone NAT.", table_cell)],
        [Paragraph("TURN", table_cell_bold), Paragraph("Traversal Using Relays around NAT", table_cell), Paragraph("Relay server protocol used when symmetric NAT prevents direct peer-to-peer traversal.", table_cell)],
        [Paragraph("P2P", table_cell_bold), Paragraph("Peer-to-Peer", table_cell), Paragraph("Direct communication between two clients without media routing through a central media server.", table_cell)],
        [Paragraph("Mesh Topology", table_cell_bold), Paragraph("Full Mesh P2P Architecture", table_cell), Paragraph("Multi-party architecture where each participant maintains direct P2P connections to all other peers.", table_cell)],
        [Paragraph("JWT", table_cell_bold), Paragraph("JSON Web Token", table_cell), Paragraph("Stateless cryptographically signed token (HMAC-SHA256) used for API & WebSocket authorization.", table_cell)],
        [Paragraph("DTLS-SRTP", table_cell_bold), Paragraph("Datagram TLS / Secure RTP", table_cell), Paragraph("Encryption protocol securing all real-time WebRTC audio and video media streams.", table_cell)],
        [Paragraph("PBX", table_cell_bold), Paragraph("Private Branch Exchange", table_cell), Paragraph("Telephony switching standard; simulated in HDTalk via Web Audio API 440Hz+480Hz dual tones.", table_cell)],
        [Paragraph("FSM", table_cell_bold), Paragraph("Finite State Machine", table_cell), Paragraph("Mathematical model governing predictable state transitions (e.g. Call Lifecycle, Typing).", table_cell)],
        [Paragraph("SPA", table_cell_bold), Paragraph("Single Page Application", table_cell), Paragraph("Client web app architecture loading a single HTML shell and updating views dynamically.", table_cell)],
        [Paragraph("DOMPurify", table_cell_bold), Paragraph("DOM Sanitization Engine", table_cell), Paragraph("Security library sanitizing HTML/SVG input to prevent Cross-Site Scripting (XSS) attacks.", table_cell)],
        [Paragraph("Multer", table_cell_bold), Paragraph("Multipart Form-Data Middleware", table_cell), Paragraph("Node.js middleware handling avatar and media uploads with MIME-type and size validation.", table_cell)],
        [Paragraph("RPO", table_cell_bold), Paragraph("Recovery Point Objective", table_cell), Paragraph("Maximum tolerable data loss period during catastrophic failure (<1 second in HDTalk).", table_cell)],
        [Paragraph("RTO", table_cell_bold), Paragraph("Recovery Time Objective", table_cell), Paragraph("Maximum allowable duration of system downtime before restoration (<3 seconds in HDTalk).", table_cell)],
        [Paragraph("FCP", table_cell_bold), Paragraph("First Contentful Paint", table_cell), Paragraph("Performance metric measuring the time from navigation to when browser renders first content.", table_cell)],
        [Paragraph("WCAG", table_cell_bold), Paragraph("Web Content Accessibility Guidelines", table_cell), Paragraph("Technical standards ensuring digital accessibility for persons with disabilities (AA level).", table_cell)],
        [Paragraph("RTM", table_cell_bold), Paragraph("Requirements Traceability Matrix", table_cell), Paragraph("Cross-reference grid mapping requirements directly to automated verification test suites.", table_cell)],
        [Paragraph("C4 Model", table_cell_bold), Paragraph("Context, Containers, Components", table_cell), Paragraph("Architectural visualization framework representing system context, topology, and code layers.", table_cell)],
        [Paragraph("Bcrypt", table_cell_bold), Paragraph("Adaptive Password Hashing", table_cell), Paragraph("Key derivation function using Blowfish cipher with 10 salt rounds against rainbow tables.", table_cell)],
        [Paragraph("replaceTrack", table_cell_bold), Paragraph("WebRTC MediaTrack Replacement", table_cell), Paragraph("RTCRtpSender API method hot-swapping camera video with screen sharing without teardown.", table_cell)],
        [Paragraph("SIGTERM", table_cell_bold), Paragraph("POSIX Termination Signal", table_cell), Paragraph("Operating system signal triggering graceful server shutdown and atomic database flush.", table_cell)],
        [Paragraph("Synergy Engine", table_cell_bold), Paragraph("Professional Matchmaking Engine", table_cell), Paragraph("Algorithmic heuristic computing cross-functional compatibility (0-100%) between users.", table_cell)]
    ]
    t_def = Table(def_data, colWidths=[28 * mm, 42 * mm, 100 * mm])
    t_def.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#B0C4DE")),
        ('TOPPADDING', (0,0), (-1,-1), 2.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_alt_row]),
    ]))
    story.append(t_def)
    story.append(PageBreak())

    # =========================================================================
    # SECTION 2: OVERALL DESCRIPTION
    # =========================================================================
    story.append(Paragraph("2. Overall Description", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_primary, spaceBefore=2, spaceAfter=8))
    
    story.append(Paragraph("2.1 Product Perspective", h2_style))
    story.append(Paragraph(
        "HDTalk operates as a self-contained, unified real-time communications application. It bridges client-side "
        "high-definition multimedia capture with server-side WebSocket signaling and low-latency atomic data storage. "
        "The architecture is depicted in the C4 Context diagram below:", body_style
    ))

    # Diagram D1: System Architecture
    d1_path = "diagrams/d1_architecture.png"
    if os.path.exists(d1_path):
        story.append(Spacer(1, 2 * mm))
        story.append(Image(d1_path, width=160 * mm, height=88 * mm))
        story.append(Paragraph("Figure 1: HDTalk System Architecture (C4 Context Diagram)", caption_style))
        story.append(Spacer(1, 2 * mm))

    story.append(Paragraph("2.2 Product Functions Overview", h2_style))
    prod_fn_data = [
        [Paragraph("Module / Domain", table_cell_h), Paragraph("Scope of Responsibility", table_cell_h), Paragraph("Key Functional Deliverables", table_cell_h)],
        [Paragraph("1. Authentication", table_cell_bold), Paragraph("Identity & Session Security", table_cell), Paragraph("User signup, bcrypt encryption, stateless JWT generation, session invalidation.", table_cell)],
        [Paragraph("2. Profiles", table_cell_bold), Paragraph("User Persona & Asset Store", table_cell), Paragraph("Bio, role, skills, avatar image upload via Multer with MIME verification.", table_cell)],
        [Paragraph("3. 1-on-1 Calling", table_cell_bold), Paragraph("Real-Time P2P Streaming", table_cell), Paragraph("WebRTC SDP exchange, ICE discovery, DTLS-SRTP encrypted audio/video channels.", table_cell)],
        [Paragraph("4. Group Calling", table_cell_bold), Paragraph("Multi-Party Mesh Media", table_cell), Paragraph("Decentralized mesh topology, multi-stream rendering, active speaker highlight.", table_cell)],
        [Paragraph("5. Text Messaging", table_cell_bold), Paragraph("Instant Chat & Feedback", table_cell), Paragraph("Sub-150ms WebSocket transmission, read receipts (blue checkmarks), reactions.", table_cell)],
        [Paragraph("6. Screen Sharing", table_cell_bold), Paragraph("Desktop & Window Broadcast", table_cell), Paragraph("1080p 30fps screen capture, mid-call replaceTrack renegotiation, PiP preview.", table_cell)],
        [Paragraph("7. File & Voice Memos", table_cell_bold), Paragraph("Asynchronous Media", table_cell), Paragraph("Multipart file uploads up to 25MB, in-browser MediaRecorder Opus audio clips.", table_cell)],
        [Paragraph("8. Conversations", table_cell_bold), Paragraph("Chat Lifecycle Management", table_cell), Paragraph("Chronological thread sorting, unread badges, pin up to 3 chats, draft saving.", table_cell)],
        [Paragraph("9. Call Controls", table_cell_bold), Paragraph("Interactive In-Call UI", table_cell), Paragraph("Hardware mute, camera toggle, mirrored self-view, 4-second auto-hiding toolbar.", table_cell)],
        [Paragraph("10. Web Audio Synth", table_cell_bold), Paragraph("Procedural Telephony Tones", table_cell), Paragraph("Dual-tone 440Hz+480Hz PBX ringback, harmonic chimes, zero external audio files.", table_cell)],
        [Paragraph("11. Dynamic Presence", table_cell_bold), Paragraph("Status & Cadence Tracking", table_cell), Paragraph("1200ms typing keepalive pulses, 3-second auto-dismiss, relative activity timestamps.", table_cell)],
        [Paragraph("12. Synergy Engine", table_cell_bold), Paragraph("Professional Matchmaking", table_cell), Paragraph("Heuristic compatibility scoring (0-100%), skill intersection, partner discovery.", table_cell)],
        [Paragraph("13. Diagnostics & CLI", table_cell_bold), Paragraph("Platform Health & Ops", table_cell), Paragraph("GET /api/health endpoint, graceful SIGTERM cleanup, db:reset and db:seed scripts.", table_cell)]
    ]
    t_pfn = Table(prod_fn_data, colWidths=[35 * mm, 45 * mm, 90 * mm])
    t_pfn.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#B0C4DE")),
        ('TOPPADDING', (0,0), (-1,-1), 2.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_alt_row]),
    ]))
    story.append(t_pfn)
    story.append(Spacer(1, 4 * mm))

    # Diagram D2: Use Case Diagram
    d2_path = "diagrams/d2_usecases.png"
    if os.path.exists(d2_path):
        story.append(KeepTogether([
            Paragraph("Figure 2: HDTalk Primary Actor Use Case Diagram", caption_style),
            Image(d2_path, width=155 * mm, height=62 * mm),
            Spacer(1, 3 * mm)
        ]))

    story.append(Paragraph("2.3 User Classes and Characteristics", h2_style))
    user_class_data = [
        [Paragraph("User Class", table_cell_h), Paragraph("Privilege Level", table_cell_h), Paragraph("Typical Technical Profile", table_cell_h), Paragraph("System Responsibilities", table_cell_h)],
        [Paragraph("System Administrator", table_cell_bold), Paragraph("Full System CLI & Health", table_cell), Paragraph("DevOps Engineer / Site Reliability Engineer", table_cell), Paragraph("Executes deployment scripts, invokes db:reset/db:seed CLI, monitors /api/health.", table_cell)],
        [Paragraph("Authenticated User", table_cell_bold), Paragraph("Standard Enterprise User", table_cell), Paragraph("Remote workers, software developers, UI/UX designers", table_cell), Paragraph("Initiates 1-on-1/mesh calls, sends text/voice messages, shares screen, matches peers.", table_cell)],
        [Paragraph("Conference Moderator", table_cell_bold), Paragraph("Room Owner Privileges", table_cell), Paragraph("Team lead, project manager, scrum master", table_cell), Paragraph("Controls group call settings, removes participants, mutes disruptive attendees.", table_cell)],
        [Paragraph("Guest User", table_cell_bold), Paragraph("Restricted View Only", table_cell), Paragraph("External client or temporary auditor", table_cell), Paragraph("Can access public profile info or test landing pages; cannot initiate calls.", table_cell)]
    ]
    t_uc = Table(user_class_data, colWidths=[35 * mm, 35 * mm, 45 * mm, 55 * mm])
    t_uc.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#B0C4DE")),
        ('TOPPADDING', (0,0), (-1,-1), 2.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_alt_row]),
    ]))
    story.append(t_uc)
    story.append(Spacer(1, 3 * mm))

    story.append(Paragraph("2.4 Operating Environment", h2_style))
    story.append(Paragraph(
        "<b>Client Browsers:</b> Google Chrome 90+, Mozilla Firefox 88+, Apple Safari 14.1+, Microsoft Edge 90+. "
        "<br/><b>Operating Systems:</b> Windows 10/11, macOS 11+, Ubuntu Linux 20.04+, Android 11+, iOS 14.5+. "
        "<br/><b>Server Environment:</b> Node.js v18.x to v22.x LTS runtime on Linux/Windows, Docker container runtime engine. "
        "<br/><b>Network:</b> Standard IPv4/IPv6 with outbound TCP port 443 (HTTPS/WSS) and UDP ports for WebRTC media.", body_style
    ))

    story.append(Paragraph("2.5 Design and Implementation Constraints", h2_style))
    story.append(Paragraph(
        "1. <b>Zero External Media Dependencies:</b> All telephony tones must be synthesized procedurally using Web Audio API oscillators. "
        "<br/>2. <b>Stateless WebRTC Signaling:</b> The server coordinates SDP offer/answers and ICE packets without transcoding media. "
        "<br/>3. <b>Atomic File Writes:</b> In-memory JSON database modifications must use temporary swap files and atomic rename operations. "
        "<br/>4. <b>Browser Sandbox:</b> Client application must run strictly within the secure browser execution context without native plugins.", body_style
    ))

    story.append(Paragraph("2.6 Assumptions and Dependencies", h2_style))
    story.append(Paragraph(
        "1. Users possess an operational microphone, camera, and network connection with at least 500 kbps uplink bandwidth. "
        "<br/>2. Public STUN servers (e.g. <code>stun.l.google.com:19302</code>) are reachable over UDP port 19302 for NAT discovery. "
        "<br/>3. The client browser has WebRTC and Web Audio API permissions explicitly granted by the user.", body_style
    ))
    story.append(PageBreak())

    # =========================================================================
    # SECTION 3: FUNCTIONAL REQUIREMENTS (FR-001 TO FR-145)
    # =========================================================================
    story.append(Paragraph("3. Functional Requirements (FR-001 to FR-145)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_primary, spaceBefore=2, spaceAfter=8))
    story.append(Paragraph(
        "This section details all <b>145 Functional Requirements</b> across the 13 core modules of HDTalk. "
        "Each requirement is uniquely identified, assigned a strict priority tag, and documented with explicit "
        "operational stimulus, system response, input/output validation, and error boundaries.", body_style
    ))

    def render_fr_module(title, fr_list):
        m_story = []
        m_story.append(Paragraph(title, h2_style))
        for item in fr_list:
            fid, priority, req_title, desc = item
            color_tag = "#CC0000" if priority == "[MUST]" else ("#CC6600" if priority == "[SHOULD]" else "#006600")
            p_text = f"<b><font color='#0066FF'>{fid}</font></b> <font color='{color_tag}'><b>{priority}</b></font> <b>{req_title}</b>: {desc}"
            m_story.append(Paragraph(p_text, body_style))
        m_story.append(Spacer(1, 2.5 * mm))
        return m_story

    story.extend(render_fr_module("3.1 User Registration, Login & Authentication Engine (FR-001 to FR-015)", fr_m1))
    story.extend(render_fr_module("3.2 User Profile Management & Avatar System (FR-016 to FR-025)", fr_m2))
    story.extend(render_fr_module("3.3 1-to-1 Audio/Video Calling Engine (FR-026 to FR-045)", fr_m3))
    story.extend(render_fr_module("3.4 Group Video Conferencing (Mesh Topology) (FR-046 to FR-060)", fr_m4))
    story.extend(render_fr_module("3.5 Real-Time Text Messaging & Chat History (FR-061 to FR-075)", fr_m5))
    story.extend(render_fr_module("3.6 High-Definition 1080p Screen Sharing Engine (FR-076 to FR-082)", fr_m6))
    story.extend(render_fr_module("3.7 File Sharing & Voice Notes System (FR-083 to FR-090)", fr_m7))
    story.extend(render_fr_module("3.8 Conversation Lifecycle Management (FR-091 to FR-105)", fr_m8))
    story.extend(render_fr_module("3.9 Call Controls & Multimedia Management (FR-106 to FR-115)", fr_m9))
    story.extend(render_fr_module("3.10 Call Recording & Web Audio Synthesis (FR-116 to FR-122)", fr_m10))
    story.extend(render_fr_module("3.11 Dynamic Presence & Typing Indicators (FR-123 to FR-130)", fr_m11))
    story.extend(render_fr_module("3.12 Professional Synergy Matchmaking Engine (FR-131 to FR-138)", fr_m12))
    story.extend(render_fr_module("3.13 Diagnostics, Health & System CLI Tools (FR-139 to FR-145)", fr_m13))
    story.append(PageBreak())

    # =========================================================================
    # SECTION 4: EXTERNAL INTERFACES
    # =========================================================================
    story.append(Paragraph("4. External Interface Requirements", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_primary, spaceBefore=2, spaceAfter=8))
    
    story.append(Paragraph("4.1 User Interfaces & ASCII Wireframes", h2_style))
    story.append(Paragraph("HDTalk features a VisionOS 2.0 glassmorphic design system with a dark electric theme (#0066FF accent). Below are the core screen wireframes:", body_style))

    wireframe_text = (
        "+-----------------------------------------------------------------------------+\n"
        "| [HDTalk Logo]      Search Peers... [Q]         [Themes]  [User: Himanshu v] |\n"
        "+-------------------+-------------------------------------+-------------------+\n"
        "| CHATS (3)         | CONVERSATION: Alex Morgan           | PEER PROFILE      |\n"
        "| +-----------------+-------------------------------------+-------------------+\n"
        "| | * Alex Morgan   | [Alex] Hey, did you test WebRTC?    | [Avatar Image]    |\n"
        "| |   Active 2m ago |                                     | Alex Morgan       |\n"
        "| |   'Let's test!' | [You] Yes! 1080p screen share is    | Full-Stack Dev    |\n"
        "| +-----------------+       ready and verified.           | Synergy: 87%      |\n"
        "| | * Sarah Chen    |                                     +-------------------+\n"
        "| |   Typing...     | Alex is typing...                   | [Audio] [Video]   |\n"
        "| +-----------------+-------------------------------------+ [Screen Share]    |\n"
        "| |   David Miller  | [Type a message...]     [Mic] [Send]| [Send File]       |\n"
        "+-------------------+-------------------------------------+-------------------+"
    )
    wireframe_table = Table([[Paragraph(f"<pre>{wireframe_text}</pre>", code_style)]], colWidths=[170 * mm])
    wireframe_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_code_bg),
        ('BOX', (0,0), (-1,-1), 1, c_accent),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(wireframe_table)
    story.append(Spacer(1, 3 * mm))

    story.append(Paragraph("4.2 Hardware & Peripheral Interfaces", h2_style))
    story.append(Paragraph(
        "1. <b>Audio Input:</b> Microphones supporting 16-bit 48kHz PCM capture. Integrated hardware AEC is leveraged when supported. "
        "<br/>2. <b>Video Input:</b> Cameras supporting standard USB Video Class (UVC) protocols with capture resolutions from 640x480 up to 1920x1080 @ 30/60 fps. "
        "<br/>3. <b>Network Hardware:</b> 802.11ac/ax Wi-Fi, Gigabit Ethernet, or 4G/5G mobile data adapters providing a minimum sustained 500 kbps symmetric bandwidth.", body_style
    ))

    story.append(Paragraph("4.3 Software & Standard API Interfaces", h2_style))
    story.append(Paragraph(
        "1. <code>navigator.mediaDevices.getUserMedia</code>: Audio and video capture. "
        "<br/>2. <code>navigator.mediaDevices.getDisplayMedia</code>: High-resolution desktop/window screen sharing. "
        "<br/>3. <code>window.RTCPeerConnection</code>: Session establishment, ICE negotiation, and encrypted media transport. "
        "<br/>4. <code>window.AudioContext</code>: Dynamic synthesizer oscillators for PBX and alert chimes. "
        "<br/>5. <code>window.localStorage</code>: Secure client-side cache for JWT tokens and conversation drafts. "
        "<br/>6. <code>Multer Middleware</code>: Express.js multipart form parsing and disk persistence for media attachments.", body_style
    ))

    story.append(Paragraph("4.4 Communications Interfaces — REST API Endpoint Matrix", h2_style))
    story.append(t_api)
    story.append(Spacer(1, 3 * mm))

    story.append(Paragraph("4.5 Real-Time Socket.io Event Signatures", h2_style))
    story.append(t_sock)
    story.append(PageBreak())

    # =========================================================================
    # SECTION 5: NON-FUNCTIONAL REQUIREMENTS
    # =========================================================================
    story.append(Paragraph("5. Non-Functional Requirements (NFR-001 to NFR-038)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_primary, spaceBefore=2, spaceAfter=8))
    story.append(Paragraph(
        "This section documents the <b>38 Non-Functional Requirements</b> governing performance thresholds, "
        "security standards, reliability metrics, and system scalability across 9 distinct categories.", body_style
    ))

    story.extend(render_nfr_block("5.1 Performance Requirements (NFR-001 to NFR-006)", nfr_perf))
    story.extend(render_nfr_block("5.2 Scalability Requirements (NFR-007 to NFR-010)", nfr_scale))
    story.extend(render_nfr_block("5.3 Security Requirements (NFR-011 to NFR-018)", nfr_sec))
    story.extend(render_nfr_block("5.4 Reliability & Availability Requirements (NFR-019 to NFR-022)", nfr_rel))
    story.extend(render_nfr_block("5.5 Usability Requirements (NFR-023 to NFR-026)", nfr_use))
    story.extend(render_nfr_block("5.6 Maintainability Requirements (NFR-027 to NFR-030)", nfr_maint))
    story.extend(render_nfr_block("5.7 Portability Requirements (NFR-031 to NFR-033)", nfr_port))
    story.extend(render_nfr_block("5.8 Compliance Requirements (NFR-034 to NFR-035)", nfr_comp))
    story.extend(render_nfr_block("5.9 Disaster Recovery Requirements (NFR-036 to NFR-038)", nfr_rec))
    story.append(PageBreak())

    # =========================================================================
    # SECTION 6: DATA REQUIREMENTS
    # =========================================================================
    story.append(Paragraph("6. Data Requirements & Schema Specifications", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_primary, spaceBefore=2, spaceAfter=8))
    
    story.append(Paragraph("6.1 Logical Data Model (Entity-Relationship)", h2_style))
    story.append(Paragraph("The HDTalk data model consists of 4 core entities interconnected as depicted in the ER diagram below:", body_style))

    if os.path.exists(d5_path):
        story.append(Spacer(1, 2 * mm))
        story.append(Image(d5_path, width=155 * mm, height=85 * mm))
        story.append(Paragraph("Figure 3: HDTalk Relational Entity-Relationship Diagram (db.json)", caption_style))
        story.append(Spacer(1, 2 * mm))

    story.append(Paragraph("6.2 Data Dictionaries", h2_style))
    story.append(Paragraph("Entity 1: <code>users</code>", h3_style))
    story.append(t_usch)
    story.append(Spacer(1, 2 * mm))

    story.append(Paragraph("Entity 2: <code>conversations</code>", h3_style))
    story.append(t_csch)
    story.append(Spacer(1, 2 * mm))

    story.append(Paragraph("Entity 3: <code>messages</code>", h3_style))
    story.append(t_msch)
    story.append(Spacer(1, 2 * mm))

    story.append(Paragraph("Entity 4: <code>connectionRequests</code>", h3_style))
    story.append(t_rsch)
    story.append(Spacer(1, 3 * mm))

    story.append(Paragraph("6.3 Atomic Persistence Pipeline", h2_style))
    story.append(Paragraph(
        "To guarantee zero data corruption without deploying a heavyweight database server, HDTalk implements a 4-phase "
        "<b>Atomic Write Pipeline</b> for all mutations to <code>backend/data/db.json</code>: "
        "<br/>1. <b>Ingest & Lock:</b> Mutation requests enter a FIFO promise queue, acquiring an in-process exclusive write lock. "
        "<br/>2. <b>Transform & Validate:</b> Schema constraints and validations are enforced on in-memory object arrays. "
        "<br/>3. <b>Flush to Temporary File:</b> Serialized JSON is flushed to a temporary staging file (<code>db.json.tmp</code>). "
        "<br/>4. <b>Atomic Rename:</b> <code>fs.renameSync()</code> replaces the target <code>db.json</code> atomically, guaranteed by the operating system kernel.", body_style
    ))
    story.append(PageBreak())

    # =========================================================================
    # SECTION 7: APPENDICES & TRACEABILITY
    # =========================================================================
    story.append(Paragraph("7. Appendices & Traceability", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_primary, spaceBefore=2, spaceAfter=8))
    
    story.append(Paragraph("7.1 Formal Use Cases", h2_style))
    story.append(t_ucase)
    story.append(Spacer(1, 3 * mm))

    if os.path.exists(d3_path):
        story.append(KeepTogether([
            Paragraph("7.2 WebRTC Call Setup & Signaling Flow", h2_style),
            Image(d3_path, width=155 * mm, height=75 * mm),
            Paragraph("Figure 4: WebRTC P2P Call Signaling & ICE Candidate Traversal Flow", caption_style),
            Spacer(1, 2 * mm)
        ]))

    if os.path.exists(d4_path):
        story.append(KeepTogether([
            Paragraph("7.3 Authentication & Session Verification Flow", h2_style),
            Image(d4_path, width=155 * mm, height=70 * mm),
            Paragraph("Figure 5: JWT Authentication, Socket Gateway Connection, and Presence Update", caption_style),
            Spacer(1, 2 * mm)
        ]))

    if os.path.exists(d6_path):
        story.append(KeepTogether([
            Paragraph("7.4 Call Lifecycle Finite State Machine", h2_style),
            Image(d6_path, width=140 * mm, height=65 * mm),
            Paragraph("Figure 6: Call Lifecycle Finite State Machine (FSM)", caption_style),
            Spacer(1, 2 * mm)
        ]))

    if os.path.exists(d7_path):
        story.append(KeepTogether([
            Paragraph("7.5 Production Deployment Topology", h2_style),
            Image(d7_path, width=155 * mm, height=80 * mm),
            Paragraph("Figure 7: Production Deployment Topology (Docker / Nginx / Node.js / STUN)", caption_style),
            Spacer(1, 3 * mm)
        ]))

    story.append(Paragraph("7.6 Requirements Traceability Matrix (RTM)", h2_style))
    story.append(Paragraph(
        "The matrix below cross-references all 13 subsystems and representative requirements with the "
        "automated verification test suite. All 35 tests have been executed with a 100% pass rate.", body_style
    ))
    story.append(t_rtm)
    story.append(Spacer(1, 3 * mm))

    story.append(Paragraph("7.7 Future Architectural Roadmap", h2_style))
    story.append(Paragraph(
        "<b>Phase 2.0 (Q3 2025): Selective Forwarding Unit (SFU) Integration:</b> Transitioning group conferences exceeding 6 participants "
        "to a lightweight WebRTC SFU (Mediasoup / Pion) to support up to 50 active video feeds without multiplying client uplink bitrates. "
        "<br/><b>Phase 2.5 (Q4 2025): Messaging Layer Security (MLS) Protocol:</b> Implementation of the IETF MLS standard (RFC 9420) "
        "to provide asynchronous end-to-end encryption for multi-party group text messaging. "
        "<br/><b>Phase 3.0 (Q1 2026): Enterprise SIP/PSTN Telephony Gateway:</b> Integration of SIP signaling bridges allowing HDTalk "
        "users to dial standard landline and mobile telephone numbers directly from the browser.", body_style
    ))
    story.append(PageBreak())

    # =========================================================================
    # SECTION 8: BACK COVER
    # =========================================================================
    story.append(Spacer(1, 35 * mm))
    story.append(Paragraph("— END OF DOCUMENT —", ParagraphStyle('EndDoc', fontName='Helvetica-Bold', fontSize=18, leading=22, textColor=c_primary, alignment=1)))
    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width="60%", thickness=1.5, color=c_accent, spaceBefore=4, spaceAfter=14))
    story.append(Paragraph("Software Requirements Specification (IEEE 830-1998)", subtitle_style))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("<b>HDTalk — Next-Gen Real-Time Communication System</b>", ParagraphStyle('BCTitle', fontName='Helvetica-Bold', fontSize=13, leading=17, alignment=1, textColor=c_dark)))
    story.append(Spacer(1, 10 * mm))

    back_meta = [
        [Paragraph("<b>Document Identifier:</b>", table_cell), Paragraph("SRS-HDTALK-2025-001", table_cell)],
        [Paragraph("<b>Document Version:</b>", table_cell), Paragraph("1.0.0 (Production Release)", table_cell)],
        [Paragraph("<b>Author & Architect:</b>", table_cell), Paragraph("Himanshu Dwivedi (himanshu@hdtalk.dev)", table_cell)],
        [Paragraph("<b>Organization:</b>", table_cell), Paragraph("HDTalk Technologies", table_cell)],
        [Paragraph("<b>Verification Summary:</b>", table_cell), Paragraph("<font color='#006600'><b>35/35 Modules 100% Passed</b></font>", table_cell)],
        [Paragraph("<b>Governing Standards:</b>", table_cell), Paragraph("IEEE Std 830-1998 / ISO/IEC/IEEE 29148:2018", table_cell)],
        [Paragraph("<b>Classification:</b>", table_cell), Paragraph("<font color='#CC0000'><b>CONFIDENTIAL — PROPRIETARY</b></font>", table_cell)]
    ]
    t_bmeta = Table(back_meta, colWidths=[50 * mm, 90 * mm])
    t_bmeta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor("#F0F4F8")),
        ('BACKGROUND', (1,0), (1,-1), colors.HexColor("#FAFCFE")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#D0D8E0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_bmeta)

    story.append(Spacer(1, 20 * mm))
    story.append(Paragraph("Generated in strict compliance with IEEE Std 830-1998 specifications.", subsub_style))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("(c) 2025 Himanshu Dwivedi. All Rights Reserved.", ParagraphStyle('Cop', fontName='Helvetica-Bold', fontSize=10, leading=14, alignment=1, textColor=c_primary)))

    # Build Document
    print(f"[INFO] Compiling {PDF_FILENAME} with NumberedCanvas...")
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"[SUCCESS] {PDF_FILENAME} compiled successfully.")

if __name__ == "__main__":
    create_srs()
