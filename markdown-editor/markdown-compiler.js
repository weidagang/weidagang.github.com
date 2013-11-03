function compile(src) {
    // split the markdown source into lines
    var lines = src.split('\n');
    
    // organize lines into blocks
    var blocks = lines2blocks(lines);
    
    // convert blocks into html
    var html = blocks2html(blocks); 

    return html;
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

function blocks2html(blocks) {
    var html = [];
    for (var i in blocks) {
        var type = blocks[i].type;
        var text = blocks[i].text;

        if ('text' == type) {
            html.push('<p>' + md2html(text) + '</p>');
        }
        else if ('code' == type) {
            html.push('<pre><code>' + text + '</code></pre>');
        }
        else if ('quote' == type) {
            html.push('<blockquote>' + text + '</blockquote>');
        }
        else if ('title' == type) {
            var level = blocks[i].level;
            html.push('<h' + level + '>' + text + '</h' + level + '>');
        }
    }
    return html.join('\n');
}

function md2html(line) {
    line = convert_link(line);
    line = convert_bold(line);
    line = convert_italic(line);
    line = convert_code(line);
    return line;
    
}

function convert_link(line) {
    return line.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}

function convert_bold(line) {
    return convert_element(line, '**', 'strong');
}

function convert_italic(line) {
    return convert_element(line, '__', 'i');
}

function convert_code(line) {
    return convert_element(line, '``', 'code');
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
