#!/usr/bin/env python3
"""Move the `upcoming` useMemo ABOVE the loading early-return in
newsletter-engine.tsx (react-hooks/rules-of-hooks fix). Run from project root."""

from pathlib import Path

F = Path('src/components/admin/newsletter-engine.tsx')
src = F.read_text()

# Extract the memo block (comment header through the dependency-array line).
comment_start = src.index('  // ---- Phase 45: the continuum')
dep_marker = '  }, [schedule, pending, libraryData, nextUp])'
block_end = src.index(dep_marker) + len(dep_marker)
block = src[comment_start:block_end]
src = src[:comment_start] + src[block_end:]

# Restructure: guard null state + local destructure inside the memo.
block = block.replace(
    '  const upcoming = useMemo(() => {\n    const cadenceMs',
    '  const upcoming = useMemo(() => {\n'
    '    if (!state) return []\n'
    '    const { schedule, pending, nextUp } = state\n'
    '    const cadenceMs',
    1,
)
block = block.replace(
    '  }, [schedule, pending, libraryData, nextUp])',
    '  }, [state, libraryData])',
)

# Insert right after the sendTime sync effect (before the early return).
anchor = (
    "  useEffect(() => {\n"
    "    if (state?.schedule) setTimeDraft(state.schedule.sendTime)\n"
    "  }, [state?.schedule?.sendTime])\n"
)
assert anchor in src, 'anchor not found'
src = src.replace(anchor, anchor + '\n' + block + '\n', 1)

F.write_text(src)

# Verify by line numbers (immune to display mangling).
lines = src.split('\n')
memo_line = next(i for i, l in enumerate(lines, 1) if 'const upcoming = useMemo' in l)
loading_line = next(i for i, l in enumerate(lines, 1) if 'if (isLoading || !state)' in l)
destructure_line = next(
    i for i, l in enumerate(lines, 1) if 'const { schedule, pending, nextUp, lastSent } = state' in l
)
print('memo at line', memo_line)
print('loading early-return at line', loading_line)
print('outer destructure at line', destructure_line)
assert memo_line < loading_line, 'useMemo still after early return!'
print('OK: hook order fixed')
