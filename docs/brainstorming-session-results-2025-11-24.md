# Brainstorming Session Results

**Session Date:** 2025-11-24
**Facilitator:** Business Analyst Mary
**Participant:** Olivier

## Session Start

**Session Approach:** AI-Recommended Techniques based on technical problem-solving context
**Focus:** Improving PII detection accuracy for A5-PII-Anonymizer

## Executive Summary

**Topic:** Ways to improve PII detection accuracy

**Session Goals:** {{stated_goals}}

**Techniques Used:** {{techniques_list}}

**Total Ideas Generated:** {{total_ideas}}

### Key Themes Identified:

{{key_themes}}

## Technique Sessions

### Technique 1: Five Whys (Deep Analysis) - 15 min

**Problem Statement:** Street addresses are being missed most of the time (false negatives)

**The Five Whys Chain:**

1. **Why are street addresses being missed?**
   - Address components (street, number, postal code, city) are NOT being recognized as a unified entity

2. **Why aren't components recognized as unified entities?**
   - There is no relationship modeling - each item is processed independently

3. **Why is there no relationship modeling?**
   - Very simple linear architecture - probably the simplest possible

4. **Why was such a simple linear architecture chosen?**
   - To minimize complexity and go straight to MVP

5. **Why was MVP speed prioritized?**
   - Proof of concept approach - validate the idea first

**ROOT CAUSE IDENTIFIED:**
The current architecture is still in "proof of concept" mode with a simple linear pass-through design. To achieve production-grade accuracy, the system needs to evolve from independent entity detection to relationship-aware entity grouping.

**KEY INSIGHT:**
"To be really useful, PII detection must work much better" - The MVP has proven the concept. Now it's time to architect for accuracy by adding relationship intelligence between detected components.

**Architecture Gap:** Single-pass → Multi-pass with entity relationship modeling

---

### Technique 2: SCAMPER Method (Structured Innovation) - 20 min

Systematic exploration through 7 improvement lenses:

#### S - SUBSTITUTE ✅
- **Selected:** Replace token-based processing with sentence/paragraph-based processing
- *Rationale:* Preserves natural semantic boundaries where addresses typically exist

#### C - COMBINE ✅
- **Selected:** Multiple detection passes (entities first, then relationships)
- **Selected:** ML detection + rule-based validation (model finds, rules verify)
- *Rationale:* Layered intelligence - Pass 1 for recall, Pass 2 for precision, Pass 3 for linking

#### A - ADAPT ✅
- **Selected:** NER linking techniques from academic NLP research
- **Selected:** Sliding window techniques from computer vision
- *Rationale:* Proven approaches for entity relationships and multi-scale pattern detection

#### M - MODIFY ✅
- **Selected:** Break "ADDRESS" into sub-types (street_address, postal_address, billing_address)
- **Selected:** Reduce processing by semantic chunks
- *Rationale:* Finer-grained control + laptop-friendly performance with preserved context

#### P - PUT TO OTHER USES
- No existing components identified for repurposing
- *Note:* Building from clean foundation

#### E - ELIMINATE
- Nothing to eliminate - MVP already lean
- *Note:* Focus on adding capabilities, not cutting

#### R - REVERSE ✅
- **Selected:** Document-type-first approach (invoice, letter, form → type-specific rules)
- **Selected:** User-guided detection (feedback loop for uncertain areas)
- *Rationale:* Context-aware detection + learning system that improves over time

**SCAMPER IDEAS SUMMARY:**
1. Sentence/paragraph-based processing (not token-based)
2. Multi-pass detection architecture
3. Hybrid ML + rule-based validation
4. NER linking techniques
5. Sliding window for context
6. Entity sub-typing (address types)
7. Semantic chunking
8. Document-type-first detection
9. User-guided feedback loop

## Idea Categorization

### Immediate Opportunities

_Ideas ready to implement now_

{{immediate_opportunities}}

### Future Innovations

_Ideas requiring development/research_

{{future_innovations}}

### Moonshots

_Ambitious, transformative concepts_

{{moonshots}}

### Insights and Learnings

_Key realizations from the session_

{{insights_learnings}}

## Action Planning

### Top 3 Priority Ideas

#### #1 Priority: {{priority_1_name}}

- Rationale: {{priority_1_rationale}}
- Next steps: {{priority_1_steps}}
- Resources needed: {{priority_1_resources}}
- Timeline: {{priority_1_timeline}}

#### #2 Priority: {{priority_2_name}}

- Rationale: {{priority_2_rationale}}
- Next steps: {{priority_2_steps}}
- Resources needed: {{priority_2_resources}}
- Timeline: {{priority_2_timeline}}

#### #3 Priority: {{priority_3_name}}

- Rationale: {{priority_3_rationale}}
- Next steps: {{priority_3_steps}}
- Resources needed: {{priority_3_resources}}
- Timeline: {{priority_3_timeline}}

## Reflection and Follow-up

### What Worked Well

{{what_worked}}

### Areas for Further Exploration

{{areas_exploration}}

### Recommended Follow-up Techniques

{{recommended_techniques}}

### Questions That Emerged

{{questions_emerged}}

### Next Session Planning

- **Suggested topics:** {{followup_topics}}
- **Recommended timeframe:** {{timeframe}}
- **Preparation needed:** {{preparation}}

---

_Session facilitated using the BMAD CIS brainstorming framework_
