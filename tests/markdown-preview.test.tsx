// @vitest-environment jsdom

import React from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import MarkdownPreview from '../src/renderer/components/MarkdownPreview'

afterEach(cleanup)

describe('MarkdownPreview', () => {
  it('renders valid frontmatter as compact read-only properties, not Markdown body', () => {
    render(
      <MarkdownPreview
        content={[
          '---',
          'type: project',
          'status: active',
          'updated: 2026-08-16',
          '---',
          '# TSUZUNE',
          '',
          '本文'
        ].join('\n')}
        notePath="10_プロジェクト/TSUZUNE.md"
        attachments={[]}
        onWikiLink={() => {}}
      />
    )

    const properties = screen.getByRole('region', { name: 'プロパティ' })
    expect(within(properties).getByText('type')).toBeTruthy()
    expect(within(properties).getByText('project')).toBeTruthy()
    expect(within(properties).getByText('status')).toBeTruthy()
    expect(within(properties).getByText('active')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'TSUZUNE' })).toBeTruthy()
    expect(screen.queryByText('status: active')).toBeNull()
  })

  it('renders ordinary Markdown without an empty properties region', () => {
    render(
      <MarkdownPreview
        content={'# 通常ノート\n\n本文'}
        notePath="00_入口/通常ノート.md"
        attachments={[]}
        onWikiLink={() => {}}
      />
    )

    expect(screen.queryByRole('region', { name: 'プロパティ' })).toBeNull()
    expect(screen.getByRole('heading', { name: '通常ノート' })).toBeTruthy()
    expect(screen.getByText('本文')).toBeTruthy()
  })

  it('keeps malformed frontmatter readable instead of hiding it', () => {
    render(
      <MarkdownPreview
        content={[
          '---',
          'status: active',
          '# Closing delimiter is missing'
        ].join('\n')}
        notePath="00_入口/不完全なノート.md"
        attachments={[]}
        onWikiLink={() => {}}
      />
    )

    expect(screen.queryByRole('region', { name: 'プロパティ' })).toBeNull()
    expect(screen.getByText('status: active')).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: 'Closing delimiter is missing' })
    ).toBeTruthy()
  })
})
