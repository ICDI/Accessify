# Ethical considerations: details

This document complements the "Ethical Considerations" section of the article on Accessify submitted to the *Journal on Interactive Systems* (JIS). The article gives a short summary, and this file records the details.

## Who took part

Both studies were carried out by the authors. No one outside the research team took part.

- **Study 1 (tool-based evaluation).** This study has no human participants. Automated instruments (axe-core, IBM Equal Access and WAVE) measure frozen copies of public pages.
- **Study 2 (expert screen-reader evaluation).** The session ran on 28 October 2026 as a single recorded video conference.
  - The evaluator is a blind co-author and a daily NVDA user. The evaluator acts as an expert evaluator rather than as a research participant.
  - One author facilitated the session and another observed it.
  - There was no formal consent form. All authors, the evaluator included, agreed to the recording of the session and to the evaluator being identified in the article as a blind researcher.

## Personal data in the Study 2 recording

Apart from what the pages publish, the personal data in the study are in the Study 2 recording and in the automatic transcript of the meeting:

- **The evaluator.** This is mainly the evaluator's voice and the evaluator's disability.
- **The facilitator and the observer.** Their voices are recorded too; both are authors.
- **Household voices.** Household voices were captured in the background. They must be edited out before the recording is archived or shared.

Before the meeting chat is archived or shared, it must be cleaned as described in the session record (`docs/pesquisa/estudo2_sessao_2026-10-28.md`). Which Study 2 materials will be shared is still to be decided: the protocol, the recording form, the session record, the transcript and the recording. The session produced no NVDA speech log.

## Page snapshots

The 100 page snapshots were captured on 24 October 2026 and are copies of public pages. Some of them contain names and photographs of people, published by third parties. The analysis concerns the accessibility of the pages, not the people they mention or show.

The snapshots are third-party content protected by Brazilian copyright law (Law 9.610/1998), so they are not released openly. They are to be deposited on Zenodo in a separate record with restricted access, granted on request to reproduce the study.

## Data sent to model providers

- **Study 1.** All model inference ran on local models served by Ollama, at zero monetary cost. The extensions sent no page content to an external model provider.
- **Study 2.** The local provider failed the extension's connection test on the evaluator's Windows computer. The extension condition therefore used OpenRouter with `openai/gpt-5-nano`, a vision model, through one author's account.
  - Text and images of the public pages visited were sent to OpenRouter and to the model's provider.
  - The calls cost less than US$ 0.01 in total.

## Computational cost

Model inference in Study 1 ran on one 8 GB consumer GPU under a power cap. The harness used about eight hours of machine time in total, including page capture.

## AI-generated image descriptions

The ethics of AI-generated image descriptions for blind users is discussed in the article, in the "Ethics of AI-generated descriptions" paragraph of the Discussion.
