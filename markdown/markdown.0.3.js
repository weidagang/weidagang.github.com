/*
 * markdown.js v0.3
 * http://weidagang.github.io/markdown
 *
 * Copyright 2013, dagang.wei 
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * 
 * Contact: weidagang@gmail.com
 *
 * Date: 2014-05-25
 */

// debug switches
var Debug = {
    line_scanner : false,
    block_scanner : false,
    html_generator : false
};

// constants 
var Line = {
    empty : 'empty',
    text : 'text', 
    title : 'title',
    equals : 'equals',
    minus : 'minus',
    dots : 'dots',
    quote_prefixed : 'quote_prefixed',
    list_prefixed : 'list_prefixed',
    minus_enclosed : 'minus_enclosed',
    line_back_quote : 'line_back_quote',
    line_quote : 'line_quote',
    table_begin : 'line_open_bracket',
    table_end : 'line_close_bracket',
    table_head : 'table_header',
    table_row : 'table_row' 
};

// utils
var utils = (function() {
    function _escape_regex(arg) {
        return arg.replace('\\', '\\\\').replace('[', '\\[').replace(']', '\\]').replace('(', '\\(').replace(')', '\\)').replace('*', '\\*');
    }

    function _escape_html(text) {
        return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    return { 
        escape_regex : _escape_regex, 
        escape_html : _escape_html
    };
})();

// lexer
var line_scanner = (function() {
    var _lex = [
        [ Line.empty, /^\s*$/ ],
        [ Line.title, /^ *#/ ],
        [ Line.equals, /^===/ ],
        [ Line.minus, /^---/ ],
        [ Line.dots, /^\.\.\./ ],
        [ Line.quote_prefixed, /^> / ],
        [ Line.list_prefixed, /^\*\s+/ ],
        [ Line.minus_enclosed, /^\s*-- (.*) --$/ ],
        [ Line.line_back_quote, /^```/ ],
        [ Line.line_quote, /^'''/ ],
        [ Line.table_begin, /^\[$/ ],
        [ Line.table_end, /^\]$/ ],
        [ Line.table_head, /^  \*\[.*\]\*$/ ],
        [ Line.table_row, /^   \[.*\]$/ ]
    ];

    function _parse(src) {
        var tokens = [];
        
        var raw_lines = src.split('\n');
        for (var i = 0; i < raw_lines.length; ++i) {
            var rline = raw_lines[i];
            var token = { type : Line.text, text : rline };   
            for (var j = 0; j < _lex.length; ++j) {
                if (_lex[j][1].test(rline)) {
                    token.type = _lex[j][0];
                    break;
                }
            }
            tokens.push(token);
        }
        
        return tokens;
    }

    return { 
        parse : _parse 
    };
})();


var block_parser = (function() {
    function IS(line_type) {
        return function(lines, idx) {
            return (idx < lines.length && lines[idx].type == line_type) ? 
                { status : true, delta : 1, operator : 'IS', token : lines[idx] } : { status : false };
        }
    }

    function NOT(line_type) {
        return function(lines, idx) {
            return (idx < lines.length && lines[idx].type == line_type) ? 
                { status : false } : { status : true, delta : 1, operator : 'NOT', token : lines[idx] };
        }
    }

    function ANY(lines, idx) {
            return (idx < lines.length) ? 
                { status : true, delta : 1, operator : 'ANY', token : lines[idx] } : { status : false };
    }

    function OPTIONAL(line_type) {
        return function(lines, idx) {
            return (idx < lines.length && lines[idx].type == line_type) ? 
                  { status : true, delta : 1, operator : 'OPTIONAL', token : lines[idx] } : 
                  { status : true, delta : 0, operator : 'OPTIONAL' };
        }
    }

    function SEQUNCE() {
        var _rules = arguments;

        return function(lines, idx) {
            var _children = [];
            var _idx = idx;
            for (var i = 0; i < _rules.length; ++i) {
                var r = _rules[i].call(this, lines, _idx);
                if (false == r.status) {
                    return { status : false };
                }
                _children .push(r);
                _idx += r.delta;
            }
            return { status : true, delta : _idx - idx, operator : 'SEQUNCE', children  : _children };
        }
    }

    function OR() {
        var _rules = arguments;

        return function(lines, idx) {
            for (var i = 0; i < _rules.length; ++i) {
                var r = _rules[i].call(this, lines, idx);
                if (true == r.status) {
                    return { status : true, delta : r.delta, operator : 'OR', children  : [r] };
                }
            }
            return { status : false };
        }
    }

    function REPEAT(rule, min, max) {
        var _min = (null != min ? min : 1);
        var _max = (null != max ? max : 1000000);

        return function(lines, idx) {
            var _children = [];
            var _idx = idx;
            while (_idx < lines.length && _children.length < _max) {
                var r = rule.call(this, lines, _idx);
                if (false == r.status) {
                    return (_children.length < min) ?
                        { status : false } :
                        { status : true, delta : _idx - idx, operator : 'REPEAT', children : _children };
                }
                else {
                    _children .push(r);
                    _idx += r.delta;
                }
            }
            return { status : true, delta : _idx - idx, operator : 'REPEAT', children : _children };
        }
    }

    function $(name) {
        return function(lines, idx) {
            var _grammar = this;
            var r = _grammar[name].call(this, lines, idx);
            if (true == r.status) {
                r.rule = name;
            }
            return r;
        }
    }

    var _grammar = {
        'article' : SEQUNCE(
                        OR(
                            $('title_1_underlined'), 
                            $('title_2_underlined'), 
                            $('title_2_underlined'),
                            $('code'),
                            $('prefixed_quote'),
                            $('enclosed_quote'),
                            $('prefixed_list'),
                            $('table'),
                            $('title'),
                            $('single_line_center'),
                            $('empty'),
                            $('text')
                        ),
                        REPEAT($('article'), 0)
                    ),
        'title_1_underlined' : SEQUNCE(IS(Line.text), IS(Line.equals)),
        'title_2_underlined' : SEQUNCE(IS(Line.text), IS(Line.minus)),
        'title_3_underlined' : SEQUNCE(IS(Line.text), IS(Line.dots)),
        'code' : SEQUNCE(
                   IS(Line.line_back_quote), 
                   REPEAT(NOT(Line.line_back_quote), 0), 
                   IS(Line.line_back_quote)
               ),
        'prefixed_quote' : REPEAT(IS(Line.quote_prefixed), 1),
        'prefixed_list' : REPEAT(IS(Line.list_prefixed), 1),
        'single_line_center' : IS(Line.minus_enclosed),
        'enclosed_quote' : SEQUNCE(
                             IS(Line.line_quote),
                                 REPEAT(NOT(Line.line_quote), 0),
                                 IS(Line.line_quote)
                         ),
        'table' : SEQUNCE(
                    IS(Line.table_begin), 
                        OPTIONAL(Line.table_head), 
                        REPEAT(IS(Line.table_row), 0), 
                        IS(Line.table_end)
                ),
        'title' : IS(Line.title),
        'empty' : REPEAT(IS(Line.empty), 1),
        'text' : SEQUNCE(ANY, REPEAT(IS(Line.text), 0))
    };
    
    function _parse(lines) {
        var r = $('article').call(_grammar, lines, 0);
        return r;
    }

    return { parse : _parse };
})();

var html_generator = (function(){
    var _lex = { 
        'image' : ['!\\[(.*?)\\]\\(([^\)]+?)\\)', '<img src="$2" alt="$1"/>'],
        'link1' : ['\\[(.+?)\\]\\(([^\)]+?)\\)', '<a href="$2">$1</a>'],
        'link2' : ['\\[(.+?)\\]\\{([^\}]+?)\\}', '<a href="$2">$1</a>'],
        'bold' : ['\\*\\*(.*?)\\*\\*', '<strong>$1</strong>'],
        'italic' : ['~~(.*?)~~', '<i>$1</i>'],
        'underline' : ['__(.*?)__', '<u>$1</u>'],
        'code' : ['``(.*?)``', '<code>$1</code>'],
        'emphasis' : ['!!(.*?)!!', '<mark>$1</mark>']
    };

    function _convert_embedded_markdown_symbols(line) {
        line = utils.escape_html(line);
        for (var key in _lex) {
            line = line.replace(new RegExp(_lex[key][0], 'g'), _lex[key][1]);
        }
        return line;
    }

    function _tokens_of(ast) {
        var r = [];
        if (ast.token) {
            r.push(ast.token);
        }
        else if (ast.children) {
            for (var i = 0; i < ast.children.length; ++i) {
                r = r.concat(_tokens_of(ast.children[i]));
            }
        }
        return r;
    }

    function _lines_of(ast) {
        var lines = [];
        var tokens = _tokens_of(ast);
        for (var i = 0; i < tokens.length; ++i) {
            lines.push(tokens[i].text);
        }
        return lines;
    }
    
    function _convert(tokens, open_tag, close_tag, join_tag, processor) {
        var html = []; 
        html.push(open_tag);
        for (var i = 0; i < tokens.length; ++i) {
            html.push(processor(tokens[i].text));
            html.push(join_tag);
        }
        html.push(close_tag);
        return html.join('');
    }

    function _convert_text_block(ast) {
        return _convert(_tokens_of(ast), '<p>', '</p>', '<br>', _convert_embedded_markdown_symbols);
    }

    function _convert_code_block(ast) {
        var tokens = _tokens_of(ast);
        return _convert(tokens.slice(1, tokens.length - 1), '<pre><code>', '</code></pre>', '\n', utils.escape_html);
    }

    function _convert_enclosed_quote_block(ast) {
        var tokens = _tokens_of(ast);
        return _convert(tokens.slice(1, tokens.length - 1), '<blockquote>', '</blockquote>', '<br>', function(text) {
            return _convert_embedded_markdown_symbols(utils.escape_html(text));
        });
    }

    function _convert_prefixed_quote_block(ast) {
        return _convert(_tokens_of(ast), '<blockquote>', '</blockquote>', '<br>', function(text) {
            return _convert_embedded_markdown_symbols(utils.escape_html(text.substring(2)));
        });
    }

    function _convert_prefixed_list_block(ast) {
        var buffer = [];
        var lines = _lines_of(ast);

        buffer.push('<ul>\n');
        for (var i = 0; i < lines.length; ++i) {
            buffer.push('<li>' + lines[i].replace(/^\*\s+(.*?)$/, '$1') + '</li>\n');
        }
        buffer.push('</ul>');

        return buffer.join('');
    }

    function _convert_single_line_center_block(ast) {
        return _convert(_tokens_of(ast), '<p style="text-align:center">', '</p>', '', function(text) {
            return _convert_embedded_markdown_symbols(text.replace(/^\s*-- (.*?) --$/, '$1'));
        });
    }

    function _convert_table_block(ast) {
        var buffer = [];
        var lines = _lines_of(ast);

        buffer.push('<table>\n');
        
        if (lines.length > 2) {
            var offset = 1;

            var regex_header = /^\s*\*\[(.+)\]\*\s*$/
            var result_header = lines[1].match(regex_header);
            if (null != result_header) {
                buffer.push('<tr>');
                var heads = result_header[1].split(',');
                for (var i = 0; i < heads.length; ++i) {
                    buffer.push('<th>' + heads[i].replace(/^\s+|\s+$/, '') + '</th>');
                }
                buffer.push('</tr>\n');
                offset = 2;
            }

            var regex_td = /^\s*\[(.+)\]\s*$/
            for (var idx = offset; idx < lines.length - 1; ++idx) {
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
        }

        buffer.push('</table>');

        return buffer.join('');
    }

    function _convert_title(ast) {
        var buffer = [];
        var rline = _lines_of(ast)[0];
        var level = rline.indexOf('#') + 1;

        buffer.push('<h' + level + '>');
        buffer.push(rline.replace(/^(\s*#+\s*)?/, "").replace(/\s*#+\s*$/, ""));
        buffer.push('</h' + level + '>');

        return buffer.join('');
    }

    function _convert_underlined_title(ast) {
        var level = 'title_1_underlined' == ast.rule ? 1 : ('title_2_underlined' == ast.rule ? 2 : 3);
        return '<h' + level + '>' + _lines_of(ast)[0] + '</h' + level + '>';
    }
    
    var _converter = {
        'text' : _convert_text_block,
        'code' : _convert_code_block,
        'enclosed_quote' : _convert_enclosed_quote_block,
        'prefixed_quote' : _convert_prefixed_quote_block,
        'prefixed_list' : _convert_prefixed_list_block,
        'single_line_center' : _convert_single_line_center_block,
        'table' : _convert_table_block,
        'title' : _convert_title,
        'title_1_underlined' : _convert_underlined_title,
        'title_2_underlined' : _convert_underlined_title,
        'title_3_underlined' : _convert_underlined_title
    };

    function _generate(ast) {
        var html = [];

        if (ast.rule && _converter[ast.rule]) {
            html.push(_converter[ast.rule](ast));
        }
        else if (ast.children) { 
            for (var i = 0; i < ast.children.length; ++i) {
                html.push(_generate(ast.children[i])); 
            }
        }

        return html.join('\n');
    }

    return { generate : _generate };
})();

function compile(src) {
    var lines = line_scanner.parse(src);
    if (Debug.line_scanner) {
        console.log("Line analysis result:");
        console.log(lines);
    }
    var ast = block_parser.parse(lines);
    if (Debug.block_scanner) {
        console.log("Block analysis result:");
        console.log(ast);
    }
    var html = html_generator.generate(ast);

    return html;
}

