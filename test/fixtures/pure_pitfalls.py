# Cas pièges de la fiche DESIGN_CHOICES/vscode/102 : TOUT ce fichier est du
# Python syntaxiquement valide et doit être coloré à l'identique en .ldpy.
a, b, c, d, i, j, k, v, x, y, ex, f, e, g, n = range(15)

w = a<b>c                 # comparaison chaînée, pas une IRI
w2 = f<a, b>c             # f< sans fermeture IRI : comparaisons
s = d[i:j]                # slice, pas un pname
s2 = d[i:j:k]             # slice étendu
s3 = d[a+b:c]             # slice avec expression
s4 = (a)[i:j]             # slice après parenthèse
s5 = "abcdef"[i:j]        # slice de chaîne
s6 = d[x if y else a:j]   # conditionnel dans un slice
s7 = d[a and b:j]         # opérateur logique dans un slice

m = {k: v}                # dict espacé
m2 = {k:v}                # dict collé
m3 = {k:v for k, v in m.items()}
m4 = {a:b, ex:v}          # paires collées multiples
st = {1, 2, 3}            # set

ann: int = 5              # annotation
annc:int = 6              # annotation collée
def fn(p, q:int=0, *args, **kw): return p + q
lam = lambda n: n * n
lam2 = lambda n:n * n     # lambda collé

if x:pass                 # suites collées
if x == y:pass
if not x:pass
while a:pass
for z in (a, b):pass

fs1 = f"{x}" + f"{x:>10}" + f"{x!r:^8}"
fs2 = f"{x=}" + f"{d} {v}"
mat = a @ b               # matmul
mat2 = "aa" @ b           # matmul espacé après chaîne

t = a if b else c
u = [z for z in range(10) if z % 2 == 0]
star = fn(*u, **m)
wal = (n := 10)
sub = d[(n := 1):j]
key = fn(p=1, q=2)

match ex:
    case 0:pass
    case z if z < 18:pass
    case _:pass
