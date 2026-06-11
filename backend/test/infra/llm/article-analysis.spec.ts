import {
  LlmValidationError,
  parseAnalysisResult,
} from '../../../src/infra/llm/article-analysis';

/**
 * The provider-agnostic core of the LLM boundary (Slice 4.2): one zod schema is
 * the source of truth for `ArticleAnalysisResult`, and every adapter funnels its
 * raw provider response through `parseAnalysisResult`. A response that does not
 * match the schema raises `LlmValidationError` and is never returned. Per-provider
 * request shaping is out of scope here (verified end-to-end by later flow slices).
 * Prior art: `test/common/pre-filter.spec.ts`.
 */
describe('parseAnalysisResult', () => {
  const valid = {
    summary: 'A concise account of the article.',
    importance: 'important',
    entities: [
      {name: 'Microsoft', type: 'company'},
      {name: 'Satya Nadella', type: 'person'},
    ],
  };

  it('parses a valid response into an ArticleAnalysisResult', () => {
    expect(parseAnalysisResult(valid)).toEqual(valid);
  });

  it('raises LlmValidationError when a required field is missing', () => {
    const {summary: _omitted, ...missingSummary} = valid;
    expect(() => parseAnalysisResult(missingSummary)).toThrow(LlmValidationError);
  });

  it('raises LlmValidationError for an Importance outside the fixed vocabulary', () => {
    expect(() => parseAnalysisResult({...valid, importance: 'spam'})).toThrow(
      LlmValidationError,
    );
  });

  it('raises LlmValidationError for an Entity Type outside the fixed vocabulary', () => {
    expect(() =>
      parseAnalysisResult({...valid, entities: [{name: 'Mars', type: 'planet'}]}),
    ).toThrow(LlmValidationError);
  });

  it('raises LlmValidationError for a malformed (non-object) response', () => {
    expect(() => parseAnalysisResult('not json')).toThrow(LlmValidationError);
    expect(() => parseAnalysisResult(null)).toThrow(LlmValidationError);
  });
});
