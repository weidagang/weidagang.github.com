function compile(src) {
    var lines = src.split('\n');

    var blocks = lines2blocks(lines);
    //console.log(blocks);
    
    var html = [];
    for (var i in blocks) {
        if ('text' == blocks[i].type) {
            var text = convert_bold(blocks[i].text);
            text = convert_italic(text);
            console.log('<p>' + text + '</p>');
            html.push('<p>' + text + '</p>');
        }
        else if ('code' == blocks[i].type) {
            console.log('<pre><code>' + blocks[i].text + '</code></pre>');
            html.push('<pre><code>' + blocks[i].text + '</code></pre>');
        }
        else if ('quote' == blocks[i].type) {
            console.log('<blockquote>' + blocks[i].text + '</blockquote>');
            html.push('<blockquote>' + blocks[i].text + '</blockquote>');
        }
        else if ('title' == blocks[i].type) {
            console.log('<h' + blocks[i].level + '>' + blocks[i].text + '</h' + blocks[i].level + '>');
            html.push('<h' + blocks[i].level + '>' + blocks[i].text + '</h' + blocks[i].level + '>');
        }
    }
    return html.join('\n');
}

function lines2blocks(lines) {
    var S_TEXT = '0';
    var S_CODE = '1';
    var S_QUOTE = '2';

    var state = S_TEXT;
    var buffer = [];
    var blocks = [];

    for (var i = 0; i < lines.length; ++i) {
        var line = lines[i];
        //console.log('line ' + i + ': ' + line);
        
        switch(state) {
            case S_TEXT:
                if ('```' == line) {
                    buffer = [];
                    state = S_CODE;
                }
                else if ('---' == line) {
                    buffer = [];
                    state = S_QUOTE;
                }
                else if ('#' == line.charAt(0)) {
                    for (var j = 0; j < line.length; ++j) {
                        if ('#' != line.charAt(j)) {
                            break;
                        }
                    }
                    
                    if (j < line.length) {
                        blocks.push({ type : 'title', text : line.replace(/^#+\s*/, "").replace(/\s*#+$/, ""), level : j});
                    }
                    else {
                        blocks.push({ type : 'text', text: line});
                    }
                }
                else {
                    if ('' != line) {
                        blocks.push({ type : 'text', text: line});
                    }
                }
                break;
            case S_CODE:
                if ('```' == line) {
                    blocks.push({ type : 'code', text: buffer.join('\n') });
                    state = S_TEXT;
                }
                else {
                    buffer.push(line);
                }
                break;
            case S_QUOTE:
                if ('---' == line) {
                    blocks.push({ type : 'quote', text: buffer.join('\n') });
                    state = S_TEXT;
                }
                else {
                    buffer.push(line);
                }
            default:
                break;
        }
    }

    return blocks;
}

function convert_bold(line) {
    return convert_element(line, '**', 'strong');
}

function convert_italic(line) {
    return convert_element(line, '__', 'i');
}

function convert_element(line, md_symbol, html_tag) {
    var startIdx = -1;
    var endIdx = -1;
    
    startIdx = line.indexOf(md_symbol);
    while (startIdx >= 0) {
        endIdx = line.indexOf(md_symbol, startIdx + 2);

        if (endIdx < 0) {
            break; 
        }

        line = line.replace(md_symbol, '<' + html_tag + '>'); 
        line = line.replace(md_symbol, '</' + html_tag + '>'); 

        startIdx = line.indexOf(md_symbol);
    }
    
    return line;
}

/*
var compiler = {};
compiler.compile = compile;
module.exports = compiler;
*/
