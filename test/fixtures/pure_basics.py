# variables
x = 10
nom = "Alice"

# conditions
if x > 5:
    print("grand")
elif x == 5:
    print("égal")
else:
    print("petit")

# boucle for
for i in range(3):
    print(i)

# boucle while
while x > 8:
    x -= 1

# fonction
def addition(a, b=0):
    return a + b

resultat = addition(2, 3)

# lambda
carre = lambda n: n * n

# listes
liste = [1, 2, 3]
liste.append(4)

# compréhension de liste
pairs = [n for n in range(10) if n % 2 == 0]

# tuple
coord = (10, 20)

# dictionnaire
personne = {"nom": "Alice", "age": 25}

# ensemble
nombres = {1, 2, 3}

# déstructuration
a, b = coord

# exceptions
try:
    resultat = 10 / 0
except ZeroDivisionError:
    print("Division par zéro")
finally:
    print("Terminé")

# classe
class Personne:
    def __init__(self, nom, age):
        self.nom = nom
        self.age = age

    def parler(self):
        return f"Je suis {self.nom}"

p = Personne("Alice", 25)

# héritage
class Etudiant(Personne):
    def __init__(self, nom, age, formation):
        super().__init__(nom, age)
        self.formation = formation

# import
import math
print(math.sqrt(16))

# gestion de fichier
with open("test.txt", "w") as fichier:
    fichier.write("Bonjour")

# générateur
def compte():
    yield 1
    yield 2
    yield 3

# annotation de type
def saluer(nom: str) -> str:
    return f"Bonjour {nom}"

# valeur None
valeur = None

# opérateur conditionnel
message = "adulte" if personne["age"] >= 18 else "mineur"

# match / case (Python 3.10+)
match personne["age"]:
    case 0:
        print("bébé")
    case age if age < 18:
        print("mineur")
    case _:
        print("majeur")