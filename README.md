# semantic-python README

The extension "linked-data-python" for Visual Studio Code enables the syntax highlighting for Linked-Data Python source files (extensions `.ldpy`).

## The Linked-Data Python syntax

The Linked-Data Python grammar only uses grammar rules supported by MicroPython 1.18, and adds support for Linked Data languages primitives and constructs: 

- prefix declaration statements: `@prefix ex: <http://example.org/> .`
- base declaration statements: `@base <http://example.org/> .`
- IRIs: `<http://example.org/>
- Prefixed names: `ex:Person` 
- RDF literals: `"hello"^^xsd:string`, `f"hello {world}"@en`
- RDF graphs: `g{ ex:Person a owl:Class ; rdfs:label "Person"@en }`

Furthermore, it allows:

- formatted IRIs: `f<http://example/org/{ id }/>`
- RDF expression variables in RDF graphs: `g{ ex:Person ex:age ?{ age } }`


## Release Notes

### 0.0.1

Initial release of the Linked-Data Python syntax highlight package for Visual Studio Code

