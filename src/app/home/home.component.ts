import { Component, inject } from '@angular/core';
import { Firestore, collectionData, collection, addDoc, CollectionReference, DocumentData, updateDoc, doc } from '@angular/fire/firestore';
import { map, Observable, tap } from 'rxjs';

interface JournalEntry {
  id: string,
  title: string,
  content: string,
  createdDate: string,
  createdDateAsDate: Date,
  updatedDate: string,
};

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  visible = true;

  journalEntries$: Observable<JournalEntry[]>;
  // firestore: Firestore = inject(Firestore);

  activeJournalEntry: JournalEntry | undefined;

  //   // Saving Date as string using JavaScript Date object
  // var dateString = new Date().toISOString();

  // // Parsing Date from string using JavaScript Date object
  // var date = new Date(Date.parse(dateString));

  constructor(private firestore: Firestore) {
    const journalCollection = this.getFirestoreJournalCollection();

    this.journalEntries$ = collectionData(journalCollection, { idField: 'id' }).pipe(
      tap((docArray) => {
        console.log('docArray', docArray);

      }),
      map((docArray) => {
        return (docArray as JournalEntry[]).map((doc) => {
          const createdDateAsDate = new Date(Date.parse(doc.createdDate))
          return { ...doc, createdDateAsDate }
        })
          .sort((a, b) => {
            const dateA = a.createdDateAsDate;//new Date(Date.parse(a.createdDate));
            const dateB = b.createdDateAsDate;//new Date(Date.parse(b.createdDate));
            return dateB.getTime() - dateA.getTime();
          });
      })
    );
  }

  setActiveEntry(entry: JournalEntry) {
    console.log('setActiveEntry', entry);

    this.activeJournalEntry = entry;
  }

  createNewActiveEntry() {
    this.activeJournalEntry = { title: '', content: '', createdDate: new Date().toISOString() } as JournalEntry;
  }

  saveActiveEntry() {
    console.log('this.activeJournalEntry', this.activeJournalEntry);
    if (this.activeJournalEntry) {
      const journalCollection = this.getFirestoreJournalCollection();
      const createdDate = this.activeJournalEntry.createdDateAsDate ? this.activeJournalEntry.createdDateAsDate.toISOString() : new Date().toISOString();


      if (this.activeJournalEntry.id === undefined) {
        console.log('Adding a new entry');

        addDoc(journalCollection, { ...this.activeJournalEntry, createdDate });
      } else {
        console.log('updating an entry');
        const docRef = doc(this.firestore, 'journal-entries', this.activeJournalEntry.id);


        updateDoc(docRef, { ...this.activeJournalEntry, createdDate, updatedDate: new Date().toISOString() })
          .then(docRef => {
            console.log("A New Document Field has been added to an existing document");
          })
          .catch(error => {
            console.log(error);
          });
      }
    }


  }

  getFirestoreJournalCollection(): CollectionReference<DocumentData> {
    const journalCollection = collection(this.firestore, 'journal-entries');
    return journalCollection;
  }
}
