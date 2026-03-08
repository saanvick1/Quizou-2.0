function fuzzyMatch(userAnswer, correctAnswer) {
    if (!userAnswer || !correctAnswer) return false;
    var normalize = function(s) {
        return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\b(the|a|an)\b/g, '').replace(/\s+/g, ' ').trim();
    };
    var u = normalize(userAnswer);
    var c = normalize(correctAnswer);
    if (!u) return false;
    if (u === c) return true;
    if (c.includes(u) && u.length > 3) return true;
    if (u.includes(c) && c.length > 3) return true;
    var cParts = correctAnswer.split(/[\/;]/);
    for (var i = 0; i < cParts.length; i++) {
        if (normalize(cParts[i]) === u) return true;
    }
    var cWords = c.split(' ');
    var uWords = u.split(' ');
    if (cWords.length > 1 && uWords.indexOf(cWords[cWords.length - 1]) !== -1 && u.length > 3) return true;
    if (cWords.length > 1) {
        var matchCount = 0;
        for (var j = 0; j < cWords.length; j++) {
            if (cWords[j].length > 2 && u.indexOf(cWords[j]) !== -1) matchCount++;
        }
        if (matchCount >= Math.ceil(cWords.length * 0.6) && matchCount >= 2) return true;
    }
    var dist = levenshteinDistance(u, c);
    var maxLen = Math.max(u.length, c.length);
    if (maxLen > 0 && (1 - dist / maxLen) >= 0.65) return true;
    if (cWords.length > 1) {
        for (var k = 0; k < cWords.length; k++) {
            if (cWords[k].length > 3) {
                var wDist = levenshteinDistance(u, cWords[k]);
                var wMax = Math.max(u.length, cWords[k].length);
                if (wMax > 0 && (1 - wDist / wMax) >= 0.7) return true;
            }
        }
    }
    var uNoSpace = u.replace(/\s/g, '');
    var cNoSpace = c.replace(/\s/g, '');
    if (uNoSpace.length > 3 && cNoSpace.length > 3) {
        var nsDist = levenshteinDistance(uNoSpace, cNoSpace);
        var nsMax = Math.max(uNoSpace.length, cNoSpace.length);
        if (nsMax > 0 && (1 - nsDist / nsMax) >= 0.65) return true;
    }
    return false;
}

function levenshteinDistance(a, b) {
    if (a.length < b.length) return levenshteinDistance(b, a);
    var m = a.length, n = b.length;
    var prev = new Array(n + 1);
    var curr = new Array(n + 1);
    for (var j = 0; j <= n; j++) prev[j] = j;
    for (var i = 1; i <= m; i++) {
        curr[0] = i;
        for (var j2 = 1; j2 <= n; j2++) {
            curr[j2] = a[i-1] === b[j2-1] ? prev[j2-1] : 1 + Math.min(prev[j2], curr[j2-1], prev[j2-1]);
        }
        var tmp = prev; prev = curr; curr = tmp;
    }
    return prev[n];
}
