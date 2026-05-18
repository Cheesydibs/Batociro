package main

import (
  "fmt"  //is nodig voor bepaalde functies//
  "net/http"   //zorgt ervoor dat dingen zoals cookies en redirects goed worden gebruikt, denk ik//
  "time"  //is voor tijd, duh//
)

type login struct{
  HashedPassword string
  SessionToken string
  CSRFToken string
}

//usernames worden samen met gegevens in een map bewaard//
var users = map[string]login{}

//alle functies (voor nu, misschien later meer)//
func main() {
  http.HandleFunc("/register", register)
  http.HandleFunc("/login", login)
  http.HandleFunc("/logout", logout)
  http.HandleFunc("/protected", protected)
  http.HandleFunc(":8080", nil)
}

func register(w http.ResponseWriter, r *http.Request){ // functie voor registeren
  if r.Method !=http.MethodPost {
    er := http.StatusMethodNotAllowed
    http.Error(w, "Invalid method", er)
    return
  }

  username := r.FormValue("username")
  password := r.FormValue("password")
  if len(username)<8 || len(password)<8{  //checked of de wachtwoord meer dan 8 carakters heeft
    er := http.StatusNotAcceptable
    http.Error(w, "Invalid username/password", er)
    return
  }

  if _, ok := users[username]; ok {   //checked of username als is gebruikt
    er := http.StatusConflict
    http.Error(w, "User already exists", er)
    return
  }

  HashedPassword, _ :=hashPassword(password)
  users[username] = login{
    HashedPassword: HashedPassword,
  }

  fmt.Fprintln(w, "User succesfully registerd!")
}

func login(w http.ResponseWriter, r *http.Request){}

func logout(w http.ResponseWriter, r *http.Request){}

func protected(w http.ResponseWriter, r *http.Request){}