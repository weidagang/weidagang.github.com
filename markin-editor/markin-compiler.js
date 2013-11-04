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
    var S_TABLE = '3';

    var state = S_TEXT;
    var buffer = [];
    var blocks = [];
    
    var EOF = '!@#$%^&*()';
    lines.push(EOF);

    for (var i = 0; i < lines.length; ++i) {
        var line = lines[i];
        //console.log('line ' + i + ': ' + line);
        
        switch(state) {
            case S_TEXT:
                if (EOF == line) {
                    if (buffer.length > 0) {
                        blocks.push({ type : 'text', text: buffer.join('<br>') });
                        buffer = [];
                    }

                    break;
                }
                else if ('```' == line) {
                    if (buffer.length > 0) {
                        blocks.push({ type : 'text', text: buffer.join('<br>') });
                        buffer = [];
                    }

                    state = S_CODE;
                }
                else if ('>>>' == line) {
                    if (buffer.length > 0) {
                        blocks.push({ type : 'text', text: buffer.join('<br>') });
                        buffer = [];
                    }

                    state = S_QUOTE;
                }
                else if ('[' == line) {
                    if (buffer.length > 0) {
                        blocks.push({ type : 'text', text: buffer.join('<br>') });
                        buffer = [];
                    }

                    state = S_TABLE;
                }
                else if (0 == line.indexOf('>')) {
                    if (buffer.length > 0) {
                        blocks.push({ type : 'text', text: buffer.join('<br>') });
                        buffer = [];
                    }

                    blocks.push({ type : 'quote', text: line.substring(1).replace('^>\s*', '') });
                    state = S_TEXT;
                }
                else {
                    var h = title_level(line);

                    if (h > 0) {
                        if (h < line.length) {
                            blocks.push({ type : 'title', text : line.replace(/^(\s*#+\s*)?/, "").replace(/\s*#+$/, ""), level : h});
                        }
                        else {
                            blocks.push({ type : 'text', text: line});
                        }
                    }
                    else {
                        if ('' != line) {
                            buffer.push(line);
                        }
                        else {
                            if (buffer.length > 0) {
                                blocks.push({ type : 'text', text: buffer.join('<br>') });
                                buffer = [];
                            }
                        }
                    }
                }
                break;
            case S_CODE:
                if (EOF == line) {
                    blocks.push({ type : 'text', text: '```' + '<br>' +  buffer.join('<br>') });
                    break;
                }
                else if ('```' == line) {
                    blocks.push({ type : 'code', text: buffer.join('\n') });
                    buffer = [];
                    state = S_TEXT;
                }
                else {
                    buffer.push(line);
                }
                break;
            case S_QUOTE:
                if (EOF == line) {
                    blocks.push({ type : 'text', text: '>>>' + '<br>' +  buffer.join('<br>') });
                    break;
                }
                else if ('>>>' == line) {
                    blocks.push({ type : 'quote', text: buffer.join('<br>') });
                    buffer = [];
                    state = S_TEXT;
                }
                else {
                    buffer.push(line);
                }
                break;
            case S_TABLE:
                if (EOF == line) {
                    blocks.push({ type : 'text', text: '[' + '<br>' +  buffer.join('<br>') });
                    break;
                }
                else if (']' == line) {
                    blocks.push({ type : 'table', lines : buffer });
                    buffer = [];
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
            html.push('<p>' + mi2html(text) + '</p>');
        }
        else if ('code' == type) {
            html.push('<pre><code>' + text + '</code></pre>');
        }
        else if ('quote' == type) {
            html.push('<blockquote>' + text + '</blockquote>');
        }
        else if ('table' == type) {
            html.push(parse_table(blocks[i].lines));
        }
        else if ('title' == type) {
            var level = blocks[i].level;
            html.push('<h' + level + '>' + text + '</h' + level + '>');
        }
    }
    return html.join('\n');
}

function parse_table(lines) {
    if (null == lines || 0 == lines.length) {
        return '<p>[<br>]</p>';
    }
    
    var buffer = [];
    buffer.push('<table>\n');
    
    var offset = 0;
    var regex_header = /^\s*\*\[(.+)\]\*\s*$/
    var result_header = lines[0].match(regex_header);
    if (null != result_header) {
        buffer.push('<tr>');
        var heads = result_header[1].split(',');
        for (var i = 0; i < heads.length; ++i) {
            buffer.push('<th>' + heads[i].replace(/^\s+|\s+$/, '') + '</th>');
        }
        buffer.push('</tr>\n');
        offset = 1;
    }

    var regex_td = /^\s*\[(.+)\]\s*$/
    for (var idx = offset; idx < lines.length; ++idx) {
        var result_td = lines[idx].match(regex_td);
        if (null != result_td) {
            buffer.push('<tr>');
            var tds = result_td[1].split(',');
            for (var i = 0; i < tds.length; ++i) {
                buffer.push('<td>' + tds[i].replace(/^\s+|\s+$/, '') + '</td>');
            }
            buffer.push('</tr>\n');
        }
    }

    buffer.push('</table>');

    return buffer.join('');
}

function mi2html(line) {
    line = convert_link(line);
    line = convert_bold(line);
    line = convert_emphasis(line);
    line = convert_italic(line);
    line = convert_underline(line);
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
    return convert_element(line, '~~', 'i');
}

function convert_underline(line) {
    return convert_element(line, '__', 'u');
}

function convert_code(line) {
    return convert_element(line, '``', 'code');
}

function convert_emphasis(line) {
    return convert_element(line, '!!', 'mark');
}

function convert_element(line, mi_symbol, html_tag) {
    var startIdx = -1;
    var endIdx = -1;
    
    startIdx = line.indexOf(mi_symbol);
    while (startIdx >= 0) {
        endIdx = line.indexOf(mi_symbol, startIdx + 2);

        if (endIdx < 0) {
            break; 
        }

        line = line.replace(mi_symbol, '<' + html_tag + '>'); 
        line = line.replace(mi_symbol, '</' + html_tag + '>'); 

        startIdx = line.indexOf(mi_symbol);
    }
    
    return line;
}

function title_level(line) {
    var i;
    var found = false;

    for (i = 0; i < line.length; ++i) {
        if ('#' == line[i]) {
            found = true;
            break;
        }
        else if (' ' != line[i]) {
            break;
        }
    }
    
    return found ? i + 1 : 0;
}

/*
var compiler = {};
compiler.compile = compile;
module.exports = compiler;
*/
