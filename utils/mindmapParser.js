<<<<<<< HEAD
/**
 * Mermaid.js Mindmap Parser
 * Parses Mermaid mindmap syntax into a structured JSON tree.
 * 
 * Example Mermaid syntax:
 *   mindmap
 *     root((Main Topic))
 *       Branch1
 *         Leaf1
 *         Leaf2
 *       Branch2
 *         Leaf3
 */

function parseMindmap(text) {
    const lines = text.split('\n').filter(line => line.trim().length > 0);

    if (lines.length === 0) {
        throw new Error('Empty mindmap text');
    }

    // Remove the "mindmap" keyword line if present
    let startIndex = 0;
    if (lines[0].trim().toLowerCase() === 'mindmap') {
        startIndex = 1;
    }

    const root = { label: '', children: [], depth: -1 };
    const stack = [root];

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trimStart();
        const indent = line.length - trimmed.length;

        // Extract label - remove shape markers like (()), [], {}, ()
        let label = trimmed
            .replace(/^\(\((.*)\)\)$/, '$1')
            .replace(/^\[(.*)\]$/, '$1')
            .replace(/^\{(.*)\}$/, '$1')
            .replace(/^\((.*)\)$/, '$1')
            .replace(/^{{(.*)}}$/, '$1')
            .replace(/^\)(.+)\($/, '$1')
            .trim();

        // Also handle inline markers
        label = label
            .replace(/\(\(/g, '').replace(/\)\)/g, '')
            .replace(/\[/g, '').replace(/\]/g, '')
            .replace(/\{\{/g, '').replace(/\}\}/g, '')
            .replace(/\{/g, '').replace(/\}/g, '')
            .trim();

        if (!label) continue;

        const node = {
            id: `node_${i}`,
            label: label,
            children: [],
            depth: indent,
            keywords: extractKeywords(label)
        };

        // Find the correct parent by indent level
        while (stack.length > 1 && stack[stack.length - 1].depth >= indent) {
            stack.pop();
        }

        stack[stack.length - 1].children.push(node);
        stack.push(node);
    }

    if (root.children.length === 0) {
        throw new Error('Could not parse any nodes from the mindmap');
    }

    return root.children[0]; // Return the root topic node
}

/**
 * Extract meaningful keywords from a label
 */
function extractKeywords(label) {
    const stopWords = new Set([
        'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'ou', 'en',
        'à', 'au', 'aux', 'pour', 'par', 'sur', 'dans', 'avec', 'the', 'a',
        'an', 'and', 'or', 'in', 'on', 'for', 'with', 'of', 'to', 'is', 'are'
    ]);

    return label
        .toLowerCase()
        .split(/[\s,;:'"()[\]{}]+/)
        .filter(w => w.length > 2 && !stopWords.has(w));
}

/**
 * Flatten the mindmap tree into a list of all nodes
 */
function flattenNodes(node) {
    const nodes = [node];
    if (node.children) {
        for (const child of node.children) {
            nodes.push(...flattenNodes(child));
        }
    }
    return nodes;
}

module.exports = { parseMindmap, flattenNodes, extractKeywords };
=======
/**
 * Mermaid.js Mindmap Parser
 * Parses Mermaid mindmap syntax into a structured JSON tree.
 * 
 * Example Mermaid syntax:
 *   mindmap
 *     root((Main Topic))
 *       Branch1
 *         Leaf1
 *         Leaf2
 *       Branch2
 *         Leaf3
 */

function parseMindmap(text) {
    const lines = text.split('\n').filter(line => line.trim().length > 0);

    if (lines.length === 0) {
        throw new Error('Empty mindmap text');
    }

    // Remove the "mindmap" keyword line if present
    let startIndex = 0;
    if (lines[0].trim().toLowerCase() === 'mindmap') {
        startIndex = 1;
    }

    const root = { label: '', children: [], depth: -1 };
    const stack = [root];

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trimStart();
        const indent = line.length - trimmed.length;

        // Extract label - remove shape markers like (()), [], {}, ()
        let label = trimmed
            .replace(/^\(\((.*)\)\)$/, '$1')
            .replace(/^\[(.*)\]$/, '$1')
            .replace(/^\{(.*)\}$/, '$1')
            .replace(/^\((.*)\)$/, '$1')
            .replace(/^{{(.*)}}$/, '$1')
            .replace(/^\)(.+)\($/, '$1')
            .trim();

        // Also handle inline markers
        label = label
            .replace(/\(\(/g, '').replace(/\)\)/g, '')
            .replace(/\[/g, '').replace(/\]/g, '')
            .replace(/\{\{/g, '').replace(/\}\}/g, '')
            .replace(/\{/g, '').replace(/\}/g, '')
            .trim();

        if (!label) continue;

        const node = {
            id: `node_${i}`,
            label: label,
            children: [],
            depth: indent,
            keywords: extractKeywords(label)
        };

        // Find the correct parent by indent level
        while (stack.length > 1 && stack[stack.length - 1].depth >= indent) {
            stack.pop();
        }

        stack[stack.length - 1].children.push(node);
        stack.push(node);
    }

    if (root.children.length === 0) {
        throw new Error('Could not parse any nodes from the mindmap');
    }

    return root.children[0]; // Return the root topic node
}

/**
 * Extract meaningful keywords from a label
 */
function extractKeywords(label) {
    const stopWords = new Set([
        'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'ou', 'en',
        'à', 'au', 'aux', 'pour', 'par', 'sur', 'dans', 'avec', 'the', 'a',
        'an', 'and', 'or', 'in', 'on', 'for', 'with', 'of', 'to', 'is', 'are'
    ]);

    return label
        .toLowerCase()
        .split(/[\s,;:'"()[\]{}]+/)
        .filter(w => w.length > 2 && !stopWords.has(w));
}

/**
 * Flatten the mindmap tree into a list of all nodes
 */
function flattenNodes(node) {
    const nodes = [node];
    if (node.children) {
        for (const child of node.children) {
            nodes.push(...flattenNodes(child));
        }
    }
    return nodes;
}

module.exports = { parseMindmap, flattenNodes, extractKeywords };
>>>>>>> bd3b8f710204045058fa663319866f741df14205
