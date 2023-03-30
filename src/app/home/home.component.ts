import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Firestore, collectionData, collection, addDoc, CollectionReference, DocumentData, updateDoc, doc, deleteDoc } from '@angular/fire/firestore';
import { MessageService } from 'primeng/api';
import { BehaviorSubject, map, mergeMap, Observable, take, tap } from 'rxjs';

interface JournalEntry {
  id: string,
  title: string,
  content: string,
  createdDate: string,
  createdDateAsDate: Date,
  updatedDate: string,
  deleted: boolean
};

interface JournalList {
  id: string,
  name: string,
  firebasePath: string
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent {
  journalLists: JournalList[] = [
    {
      id: 'Chibs',
      name: 'Chibuzors Journal',
      firebasePath: 'journal-entries'
    },
    {
      id: 'Katherine',
      name: 'Katherines Journal',
      firebasePath: 'katherine-journal-entries'
    }
  ];

  activeJournalList$: BehaviorSubject<JournalList> = new BehaviorSubject(this.journalLists[0]);
  visible = true;

  journalEntries$: Observable<JournalEntry[]>;

  activeJournalEntry: JournalEntry | undefined;

  //   // Saving Date as string using JavaScript Date object
  // var dateString = new Date().toISOString();

  // // Parsing Date from string using JavaScript Date object
  // var date = new Date(Date.parse(dateString));

  constructor(private firestore: Firestore, private messageService: MessageService) {
    this.journalEntries$ = this.activeJournalList$.pipe(
      map(journalList => this.getFirestoreJournalCollection(journalList)),
      mergeMap(journalCollection => collectionData(journalCollection, { idField: 'id' })),
      tap((docArray) => {
        console.log('docArray', docArray);
      }),
      map((docArray) => {
        return (docArray as JournalEntry[])
          .filter(doc => {
            return doc.deleted === undefined || doc.deleted === false
          })
          .map((doc) => {
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
    this.activeJournalEntry = entry;
  }

  createNewActiveEntry() {
    this.activeJournalEntry = { title: `${new Date().toDateString()} - `, content: '', createdDate: new Date().toISOString(), createdDateAsDate: new Date(), deleted: false } as JournalEntry;
  }

  saveActiveEntry() {
    this.activeJournalList$.pipe(
      take(1),
      tap(currentActiveJournal => {
        if (this.activeJournalEntry) {
          const journalCollection = this.getFirestoreJournalCollection(currentActiveJournal);
          const createdDate = this.activeJournalEntry.createdDateAsDate ? this.activeJournalEntry.createdDateAsDate.toISOString() : new Date().toISOString();


          if (this.activeJournalEntry.id === undefined) {
            addDoc(journalCollection, { ...this.activeJournalEntry, createdDate }).then(_result => {
              this.messageService.add({
                severity: 'success',
                summary: `Add of ${this.activeJournalEntry?.title} Successful`,
                data: 'Journal Entry Added Successfully'
              });
            });
          } else {
            const docRef = doc(this.firestore, currentActiveJournal.firebasePath, this.activeJournalEntry.id);


            updateDoc(docRef, { ...this.activeJournalEntry, createdDate, updatedDate: new Date().toISOString() })
              .then(_result => {
                this.messageService.add({
                  severity: 'success',
                  summary: `Update of ${this.activeJournalEntry?.title} Successful`,
                  data: 'Update Occurred Successfully'
                });
              })
              .catch(error => {
                console.log(error);
              });
          }
        }

      })
    ).subscribe();
  }

  deleteJournalEntry(entry: JournalEntry) {
    this.activeJournalList$.pipe(
      take(1),
      tap(currentActiveJournal => {
        if (entry) {
          const entryName = entry.title;
          const createdDate = entry.createdDateAsDate ? entry.createdDateAsDate.toISOString() : new Date().toISOString();

          const docRef = doc(this.firestore, currentActiveJournal.firebasePath, entry.id);

          updateDoc(docRef, { ...entry, createdDate, updatedDate: new Date().toISOString(), deleted: true })
            .then(_result => {
              this.messageService.add({
                severity: 'success',
                summary: `Delete of ${entryName} Successful`,
                data: 'Delete Occurred Successfully'
              });
            })
            .catch(error => {
              console.log(error);
            });
        }

      })
    ).subscribe();

    // True Delete 
    // this.activeJournalList$.pipe(
    //   take(1),
    //   tap(currentActiveJournal => {
    //     if (entry) {
    //       const docRef = doc(this.firestore, currentActiveJournal.firebasePath, entry.id);

    //       deleteDoc(docRef);
    //     }
    //   })
    // ).subscribe();
  }

  getFirestoreJournalCollection(newActiveJournalList: JournalList): CollectionReference<DocumentData> {
    const journalListToUse: JournalList = newActiveJournalList;

    // console.log('The journalListToUse is', journalListToUse);

    const journalCollection = collection(this.firestore, journalListToUse.firebasePath);
    return journalCollection;
  }
}
